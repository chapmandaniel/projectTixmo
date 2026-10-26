import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { scannerService } from '../api/scanners/service';
import { scannerAuthFailureLimiter } from './rateLimiter';

export interface ScannerRequest extends Request {
  scanner?: {
    id: string;
    name: string;
    organizationId: string;
    eventId?: string | null;
  };
  scannerId?: string;
}

/**
 * Scanner authentication middleware
 * Extracts and validates scanner API key from Authorization header
 */
export const authenticateScanner = async (
  req: ScannerRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw ApiError.unauthorized('Scanner API key required');
    }

    // Extract API key from "Bearer sk_scanner_..." or just "sk_scanner_..."
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    if (!apiKey.startsWith('sk_scanner_')) {
      throw ApiError.unauthorized('Invalid scanner API key format');
    }

    // Authenticate scanner
    const scanner = await scannerService.authenticateScanner(apiKey);

    // Attach scanner info to request
    req.scanner = {
      id: scanner.id,
      name: scanner.name,
      organizationId: scanner.organizationId,
      eventId: scanner.eventId,
    };
    req.scannerId = scanner.id;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Scanner auth for scan, offline sync, and validate.
 * A rejected key is counted against the caller's IP. The admission limiter
 * runs only after this succeeds, keyed by scanner id.
 */
export const authenticateAdmissionScanner = (
  req: ScannerRequest,
  res: Response,
  next: NextFunction
): void => {
  void authenticateScanner(req, res, (error?: unknown) => {
    if (!error) {
      next();
      return;
    }

    const statusCode = error instanceof ApiError ? error.statusCode : undefined;
    if (statusCode !== 401 && statusCode !== 403) {
      next(error);
      return;
    }

    scannerAuthFailureLimiter(req, res, (limitError?: unknown) => {
      if (res.headersSent) return;
      next(limitError ?? error);
    });
  });
};
