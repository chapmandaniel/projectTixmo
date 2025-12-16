import { verifyAccessToken } from '@utils/jwt';
import { ApiError } from '@utils/ApiError';
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: { userId: string; role: string; email?: string } | null;
}

export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction) => {
  // treat header as unknown then narrow to avoid assigning `any` to typed variables
  const headerRaw = req.headers['authorization'] as unknown;
  let headerValue: string | undefined;

  if (Array.isArray(headerRaw) && headerRaw.length > 0 && typeof headerRaw[0] === 'string') {
    headerValue = headerRaw[0];
  } else if (typeof headerRaw === 'string') {
    headerValue = headerRaw;
  } else {
    headerValue = undefined;
  }

  if (!headerValue || typeof headerValue !== 'string') {
    return next(ApiError.unauthorized('No token provided'));
  }

  const token = headerValue.startsWith('Bearer ') ? headerValue.slice(7) : headerValue;

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, role: payload.role, email: payload.email };
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Invalid token'));
  }
};

export const optionalAuthenticate = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const headerRaw = req.headers['authorization'] as unknown;
  let headerValue: string | undefined;

  if (Array.isArray(headerRaw) && headerRaw.length > 0 && typeof headerRaw[0] === 'string') {
    headerValue = headerRaw[0];
  } else if (typeof headerRaw === 'string') {
    headerValue = headerRaw;
  } else {
    headerValue = undefined;
  }

  if (!headerValue || typeof headerValue !== 'string') {
    return next();
  }

  const token = headerValue.startsWith('Bearer ') ? headerValue.slice(7) : headerValue;

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, role: payload.role, email: payload.email };
    return next();
  } catch (err) {
    return next();
  }
};
