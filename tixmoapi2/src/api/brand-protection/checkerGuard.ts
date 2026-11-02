import { createHash } from 'crypto';
import { NextFunction, Response } from 'express';
import prisma from '../../config/prisma';
import { config, isGiveawayProtectionEnabled } from '../../config/environment';
import { AuthRequest } from '../../middleware/auth';
import { giveawayIngestIpRateLimiter } from '../../middleware/rateLimiter';
import { ApiError } from '../../utils/ApiError';
import { CHECKER_TOKEN_PREFIX } from './constants';

const ingestPaths = () =>
  new Set([
    `/api/${config.apiVersion}/brand-protection/ingest/matches`,
    `/api/${config.apiVersion}/brand-protection/ingest/status`,
    `/api/${config.apiVersion}/brand-protection/ingest/verifications`,
  ]);

const bearerToken = (req: AuthRequest): string | undefined => {
  const value = req.get('authorization');
  if (!value) return undefined;
  const token = value.startsWith('Bearer ') ? value.slice(7).trim() : value.trim();
  if (!token.startsWith(CHECKER_TOKEN_PREFIX) || token.length > 200) return undefined;
  return token;
};

const requestPath = (req: AuthRequest): string => {
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  return path || '/';
};

const isBrandPath = (req: AuthRequest): boolean =>
  requestPath(req).includes(`/${config.apiVersion}/brand-protection`);

const isAllowedIngest = (req: AuthRequest): boolean =>
  req.method === 'POST' && ingestPaths().has(requestPath(req));

export const hashCheckerToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/**
 * Checker tokens are write-only. A recognized token cannot pass this guard
 * except on the ingest writes, and only while the feature flag is on.
 * Unknown bearers fall through to ordinary session auth.
 */
const authenticateCheckerToken = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const token = bearerToken(req);
    if (!token) return next();

    const row = await prisma.giveawayCheckerToken.findUnique({
      where: { tokenHash: hashCheckerToken(token) },
    });
    if (!row) return next();

    if (!isGiveawayProtectionEnabled()) {
      if (isBrandPath(req)) return next(ApiError.notFound('Route not found'));
      return next(ApiError.forbidden('Checker token cannot access this route'));
    }
    if (!isAllowedIngest(req)) {
      return next(ApiError.forbidden('Checker token cannot access this route'));
    }
    if (row.revokedAt) return next(ApiError.unauthorized('Checker token revoked'));

    await prisma.giveawayCheckerToken.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });
    req.checkerTokenId = row.id;
    return next();
  } catch (error) {
    return next(error);
  }
};

const countIngestAuthFailure = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  error: unknown
) => {
  giveawayIngestIpRateLimiter(req, res, (limitError?: unknown) => {
    if (res.headersSent) return;
    next(limitError ?? error);
  });
};

/**
 * Ingest auth is checked first. Only a missing, unknown, or revoked checker
 * token consumes the per-IP failure bucket. A valid token skips that limiter
 * and is counted later per token id.
 */
export const guardCheckerToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  void authenticateCheckerToken(req, res, (error?: unknown) => {
    if (!isAllowedIngest(req)) {
      next(error);
      return;
    }
    if (!error && req.checkerTokenId) {
      next();
      return;
    }
    if (!error || (error instanceof ApiError && error.statusCode === 401)) {
      countIngestAuthFailure(
        req,
        res,
        next,
        error ?? ApiError.unauthorized('Checker token required')
      );
      return;
    }
    next(error);
  });
};

export const requireCheckerToken = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.checkerTokenId) return next(ApiError.unauthorized('Checker token required'));
  return next();
};
