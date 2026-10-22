import { assetShareLogPath } from '../utils/assetShareLogPath';
import { buyerRecoveryLogPath } from '../utils/buyerRecoveryLogPath';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const safeUrl =
      buyerRecoveryLogPath(req.originalUrl) ||
      assetShareLogPath(req.originalUrl) ||
      req.originalUrl;
    const message = `${req.method} ${safeUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.http(message);
    }
  });

  next();
};
