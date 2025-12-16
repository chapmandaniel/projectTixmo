import { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

export const notFoundHandler = (req: Request, _res: Response) => {
  throw new ApiError(404, `Route ${req.originalUrl} not found`);
};
