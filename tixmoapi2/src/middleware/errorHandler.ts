import { logger } from '@config/logger';
import { ApiError } from '@utils/ApiError';
import { config } from '@config/environment';
import { redactGiveawayLogText } from '@utils/giveawayLogRedaction';
import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    logger.warn(
      redactGiveawayLogText(`API error ${err.message} ${JSON.stringify(err.errors ?? '')}`)
    );
    if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));
    if (err.code === 'CHECKOUT_BUSY') res.set('Cache-Control', 'no-store');
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code, retryAfter: err.retryAfter } : {}),
      errors: err.errors,
      ...(err.data !== undefined ? { data: err.data } : {}),
    });
  }

  const unexpected = err as Error;
  logger.error(redactGiveawayLogText(`Unexpected error ${unexpected.stack || unexpected.message}`));

  if (config.nodeEnv === 'development') {
    return res
      .status(500)
      .json({ success: false, message: (err as Error).message, stack: (err as Error).stack });
  }

  return res.status(500).json({ success: false, message: 'Internal Server Error' });
};
