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

export const logout = catchAsync(async (_req: AuthRequest, res: Response) => {
  // For JWT, logout is handled client-side by removing the token
  // This endpoint can be used for logging/analytics or token blacklisting
  // Add a no-op await so the function remains async (required by linter/catchAsync)
  await Promise.resolve();
  res.status(200).json(successResponse(null, 'Logout successful'));
});
