import { createHash } from 'crypto';
import { NextFunction, Response } from 'express';
import prisma from '../../config/prisma';
import { config, isGiveawayProtectionEnabled } from '../../config/environment';
import { AuthRequest } from '../../middleware/auth';
import {
  giveawayIngestIpRateLimiter,
  isGiveawayIngestAuthBlocked,
} from '../../middleware/rateLimiter';
import { ApiError } from '../../utils/ApiError';
import { CHECKER_TOKEN_PREFIX, type CheckerScopeName } from './constants';

/** Match Express's case-insensitive routes and collapse the slashes Express leaves in place. */
const normalizeRequestPath = (raw: string): string => {
  const withoutQuery = raw.split('?')[0] ?? '';
  const collapsed = withoutQuery.replace(/\/{2,}/g, '/').toLowerCase();
  const stripped = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
  return stripped || '/';
};

const requestPath = (req: AuthRequest): string => normalizeRequestPath(req.originalUrl);

let cachedApiVersion = '';
let ingestPaths = new Set<string>();
let targetsPath = '';
let brandPathMarker = '';

const refreshRouteCache = () => {
  if (cachedApiVersion === config.apiVersion) return;
  cachedApiVersion = config.apiVersion;
  const prefix = `/api/${config.apiVersion}/brand-protection/ingest/`;
  ingestPaths = new Set([`${prefix}matches`, `${prefix}status`, `${prefix}verifications`]);
  targetsPath = `${prefix}targets`;
  brandPathMarker = `/${config.apiVersion}/brand-protection`;
};

type CheckerRoute = 'ingest' | 'targets';

const checkerRoute = (req: AuthRequest): CheckerRoute | null => {
  refreshRouteCache();
  const path = requestPath(req);
  if (req.method === 'POST' && ingestPaths.has(path)) return 'ingest';
  if (req.method === 'GET' && path === targetsPath) return 'targets';
  return null;
};

const requiredScope = (route: CheckerRoute): CheckerScopeName =>
  route === 'targets' ? 'targets:read' : 'ingest:write';

const hasScope = (scopes: string[] | null | undefined, scope: CheckerScopeName): boolean =>
  Array.isArray(scopes) && scopes.includes(scope);

const bearerToken = (req: AuthRequest): string | undefined => {
  const value = req.get('authorization');
  if (!value) return undefined;
  const token = value.startsWith('Bearer ') ? value.slice(7).trim() : value.trim();
  if (!token.startsWith(CHECKER_TOKEN_PREFIX) || token.length > 200) return undefined;
  return token;
};

const isBrandPath = (req: AuthRequest): boolean => {
  refreshRouteCache();
  return requestPath(req).includes(brandPathMarker);
};

export const hashCheckerToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/**
 * A recognized checker token can pass this guard only on the ingest writes it
 * is scoped for, or on the targets read when that scope was granted explicitly.
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
      return next(ApiError.notFound('Route not found'));
    }
    const route = checkerRoute(req);
    if (!route) {
      return next(ApiError.forbidden('Checker token cannot access this route'));
    }
    if (row.revokedAt) return next(ApiError.unauthorized('Checker token revoked'));
    if (!hasScope(row.scopes, requiredScope(route))) {
      return next(ApiError.forbidden('Checker token cannot access this route'));
    }

    await prisma.giveawayCheckerToken.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });
    req.checkerTokenId = row.id;
    req.checkerTokenScopes = row.scopes;
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
  if (!isGiveawayProtectionEnabled()) {
    return next(ApiError.notFound('Route not found'));
  }
  giveawayIngestIpRateLimiter(req, res, (limitError?: unknown) => {
    if (res.headersSent) return;
    next(limitError ?? error);
  });
};

const authenticateThenCountFailures = (req: AuthRequest, res: Response, next: NextFunction) => {
  void authenticateCheckerToken(req, res, (error?: unknown) => {
    if (!checkerRoute(req)) {
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

/**
 * Ingest auth is checked first. Only a missing, unknown, or revoked checker
 * token consumes the per-IP failure bucket. A valid token skips that limiter
 * and is counted later per token id. An IP already over that cap is rejected
 * before the token table is read. While the feature flag is off, brand routes
 * and every request carrying a checker token stay a uniform 404.
 */
export const guardCheckerToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const route = checkerRoute(req);
  const token = bearerToken(req);
  // Ordinary order and public reads never carry a checker token. This return
  // stays synchronous: no promise, Redis, or Postgres. A checker token while
  // the feature flag is off is also a synchronous 404, on every path.
  if (!isGiveawayProtectionEnabled()) {
    if (token || isBrandPath(req)) {
      next(ApiError.notFound('Route not found'));
      return;
    }
    next();
    return;
  }
  if (!route && !token) {
    next();
    return;
  }
  if (!route) {
    authenticateThenCountFailures(req, res, next);
    return;
  }
  void isGiveawayIngestAuthBlocked(req)
    .then((blocked) => {
      if (!blocked) {
        authenticateThenCountFailures(req, res, next);
        return;
      }
      giveawayIngestIpRateLimiter(req, res, (limitError?: unknown) => {
        if (res.headersSent) return;
        if (limitError) return next(limitError);
        authenticateThenCountFailures(req, res, next);
      });
    })
    .catch(next);
};

export const requireCheckerToken = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.checkerTokenId) return next(ApiError.unauthorized('Checker token required'));
  return next();
};
