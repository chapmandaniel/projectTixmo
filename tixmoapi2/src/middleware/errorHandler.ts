import { logger } from '@config/logger';
import { ApiError } from '@utils/ApiError';
import { config } from '@config/environment';
import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    logger.warn('API error', err);
    return res
      .status(err.statusCode)
      .json({ success: false, message: err.message, errors: err.errors });
  }

  logger.error('Unexpected error', err as Error);

  if (config.nodeEnv === 'development') {
    return res
      .status(500)
      .json({ success: false, message: (err as Error).message, stack: (err as Error).stack });
  }

  return res.status(500).json({ success: false, message: 'Internal Server Error' });
};
