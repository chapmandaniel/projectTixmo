import { assetShareLogPath } from '../utils/assetShareLogPath';
import { buyerRecoveryLogPath } from '../utils/buyerRecoveryLogPath';
import { redactGiveawayLogText } from '../utils/giveawayLogRedaction';
import { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

export const notFoundHandler = (req: Request, _res: Response) => {
  const recovery = buyerRecoveryLogPath(req.originalUrl);
  const safeUrl = redactGiveawayLogText(assetShareLogPath(req.originalUrl) || req.originalUrl);
  throw new ApiError(
    404,
    recovery ? 'Password recovery route not found' : `Route ${safeUrl} not found`
  );
};
