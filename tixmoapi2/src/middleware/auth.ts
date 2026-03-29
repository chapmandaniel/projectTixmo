import { verifyAccessToken } from '@utils/jwt';
import { ApiError } from '@utils/ApiError';
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    email?: string;
    emailVerified?: boolean;
    organizationId?: string | null;
  } | null;
}

const getAuthorizationHeader = (req: Request): string | undefined => {
  const headerRaw = req.headers['authorization'] as unknown;

  if (Array.isArray(headerRaw) && headerRaw.length > 0 && typeof headerRaw[0] === 'string') {
    return headerRaw[0];
  }

  if (typeof headerRaw === 'string') {
    return headerRaw;
  }

  return undefined;
};

export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (req.user) {
    return next();
  }

  const headerValue = getAuthorizationHeader(req);

  if (!headerValue) {
    return next(ApiError.unauthorized('No token provided'));
  }

  const token = headerValue.startsWith('Bearer ') ? headerValue.slice(7) : headerValue;

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
      emailVerified: payload.emailVerified,
      organizationId: payload.organizationId,
    };
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Invalid token'));
  }
};

export const optionalAuthenticate = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (req.user) {
    return next();
  }

  const headerValue = getAuthorizationHeader(req);

  if (!headerValue) {
    return next();
  }

  const token = headerValue.startsWith('Bearer ') ? headerValue.slice(7) : headerValue;

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
      emailVerified: payload.emailVerified,
      organizationId: payload.organizationId,
    };
    return next();
  } catch (err) {
    return next();
  }
};
