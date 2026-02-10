import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { userService, CreateUserInput, UpdateUserInput, ListUsersParams } from './service';

export const createUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as CreateUserInput;
  // TODO: Add authorization check here if needed validation pass but authorization fail
  const user = await userService.createUser(payload);
  res.status(201).json(successResponse(user, 'User created successfully'));
});

export const getUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const user = await userService.getUserById(id);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Users can only view their own profile unless they're admin
  if (req.user!.userId !== id && req.user!.role !== 'ADMIN') {
    throw ApiError.forbidden('You can only view your own profile');
  }

  res.json(successResponse(user));
});

export const updateUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Users can only update their own profile unless they're admin
  if (req.user!.userId !== id && req.user!.role !== 'ADMIN') {
    throw ApiError.forbidden('You can only update your own profile');
  }

  const payload = req.body as UpdateUserInput;
  const user = await userService.updateUser(id, payload);
  res.json(successResponse(user, 'User updated successfully'));
});

export const deleteUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await userService.deleteUser(id);
  res.status(204).send();
});

export const listUsers = catchAsync(async (req: AuthRequest, res: Response) => {
  const query = req.query as unknown as ListUsersParams;
  const result = await userService.listUsers(query);
  res.json(successResponse(result));
});
