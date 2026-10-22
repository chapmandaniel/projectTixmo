import { Response } from 'express';
import { authService } from './service';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface LoginData {
  email: string;
  password: string;
}

export const register = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as RegisterData;
  const result = await authService.register(payload);

  res.status(201).json(successResponse(result, 'User registered successfully'));
});

export const login = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as LoginData;
  const result = await authService.login(payload);

  res.status(200).json(successResponse(result, 'Login successful'));
});

export const refreshToken = catchAsync(async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };
  const tokens = await authService.refreshToken(refreshToken);

  res.status(200).json(successResponse(tokens, 'Token refreshed successfully'));
});

export const getCurrentUser = catchAsync(async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const user = await authService.getCurrentUser(req.user.userId);

  res.status(200).json(successResponse(user, 'User retrieved successfully'));
});

export const logout = catchAsync(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  await authService.logout(req.user.userId);
  res.status(200).json(successResponse(null, 'Logout successful'));
});

export const acceptInvitation = catchAsync(async (req: AuthRequest, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };
  const result = await authService.acceptInvitation(token, password);
  res.status(200).json(successResponse(result, 'Invitation accepted'));
});

export const forgotPassword = catchAsync(async (req: AuthRequest, res: Response) => {
  // Respond before account lookup/delivery so existence and transport latency cannot enumerate buyers.
  res
    .status(202)
    .json(
      successResponse(
        null,
        'If this email belongs to an eligible buyer, a reset link will be sent.'
      )
    );
  try {
    const { requestBuyerPasswordReset } = await import('./buyerPasswordRecovery');
    await requestBuyerPasswordReset((req.body as { email: string }).email);
  } catch {
    const { logger } = await import('../../config/logger');
    logger.warn('Buyer password recovery request could not complete');
  }
});
export const resetPassword = catchAsync(async (req: AuthRequest, res: Response) => {
  const { redeemBuyerPasswordReset } = await import('./buyerPasswordRecovery');
  const { token, password } = req.body as { token: string; password: string };
  await redeemBuyerPasswordReset(token, password);
  res.status(200).json(successResponse(null, 'Password changed. Sign in with your new password.'));
});
