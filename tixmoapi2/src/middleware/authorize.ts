import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { ApiError } from '../utils/ApiError';

type UserRole = 'OWNER' | 'ADMIN' | 'PROMOTER' | 'CUSTOMER' | 'SCANNER' | 'TEAM_MEMBER';

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role as UserRole)) {
        throw ApiError.forbidden('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireEmailVerification = (_req: AuthRequest, _res: Response, next: NextFunction) => {
  // This would check email verification status
  // Implementation depends on your requirements
  next();
};
