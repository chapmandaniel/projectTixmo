import { Request, Response, NextFunction } from 'express';
import { scannerService } from './service';
import { ApiError } from '../../utils/ApiError';
import { successResponse } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';
import { ScannerRequest } from '../../middleware/scannerAuth';

/**
 * Register a new scanner
 */
export const registerScanner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const scanner = await scannerService.registerScanner({
      ...req.body,
      createdBy: req.user!.userId,
    });
    res.status(201).json(successResponse(scanner, 'Scanner registered successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticate scanner
 */
export const authenticateScanner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const scanner = await scannerService.authenticateScanner(req.body.apiKey);
    const { apiKey: _apiKey, ...scannerData } = scanner;
    res.json(successResponse(scannerData, 'Scanner authenticated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * List scanners
 */
export const listScanners = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await scannerService.listScanners(req.query);
    // Remove API keys from list
    const scannersWithoutKeys = result.scanners.map(({ apiKey: _apiKey, ...scanner }) => scanner);

    res.json(
      successResponse(scannersWithoutKeys, 'Scanners retrieved successfully', result.pagination)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get scanner by ID
 */
export const getScanner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const scanner = await scannerService.getScannerById(req.params.id);
    if (!scanner) {
      throw ApiError.notFound('Scanner not found');
    }
    const { apiKey: _apiKey, ...scannerData } = scanner;
    res.json(successResponse(scannerData, 'Scanner retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update scanner
 */
export const updateScanner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const scanner = await scannerService.updateScanner(req.params.id, req.body);
    const { apiKey: _apiKey, ...scannerData } = scanner;
    res.json(successResponse(scannerData, 'Scanner updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete scanner
 */
export const deleteScanner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await scannerService.deleteScanner(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Scan ticket
 */
export const scanTicket = async (
  req: ScannerRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await scannerService.scanTicket({
      scannerId: req.scanner!.id,
      qrData: req.body.qrData,
      scanType: req.body.scanType,
      metadata: req.body.metadata,
    });
    res.json(
      successResponse(
        result,
        result.success ? 'Ticket scanned successfully' : 'Scan validation failed'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get scan logs
 */
export const getScanLogs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await scannerService.getScanLogs(req.query);
    res.json(
      successResponse(result.scanLogs, 'Scan logs retrieved successfully', result.pagination)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Sync tickets for offline validation
 */
export const syncTickets = async (
  req: ScannerRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stream = scannerService.syncTicketsStream(
      req.scanner!.id,
      req.query.eventId as string,
      req.query.since ? new Date(req.query.since as string) : undefined
    );

    res.setHeader('Content-Type', 'application/json');
    res.write('{"success":true,"data":{"tickets":[');

    let isFirstBatch = true;
    for await (const batch of stream) {
      if (!isFirstBatch) {
        res.write(',');
      } else {
        isFirstBatch = false;
      }

      const json = JSON.stringify(batch);
      // Remove [ and ] from the stringified array to append items directly
      res.write(json.substring(1, json.length - 1));
    }

    const timestamp = new Date().toISOString();
    res.write(`],"timestamp":"${timestamp}"},"message":"Tickets synced successfully"}`);
    res.end();
  } catch (error) {
    next(error);
  }
};

/**
 * Sync offline scans
 */
export const syncOfflineScans = async (
  req: ScannerRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await scannerService.processOfflineScans(req.scanner!.id, req.body.scans);
    res.json(successResponse(result, 'Offline scans processed successfully'));
  } catch (error) {
    next(error);
  }
};
