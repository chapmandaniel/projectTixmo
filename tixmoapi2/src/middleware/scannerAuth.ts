import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { scannerService } from '../api/scanners/service';

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
