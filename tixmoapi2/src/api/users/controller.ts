import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { userService, CreateUserInput, UpdateUserInput, ListUsersParams } from './service';
import prisma from '../../config/prisma';

export const createUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as CreateUserInput;
  const caller = req.user!;

  // 1. Role Hierarchy Check
  const roleHierarchy = {
    OWNER: 4,
    ADMIN: 3,
    PROMOTER: 2,
    TEAM_MEMBER: 1,
    SCANNER: 1,
    CUSTOMER: 0,
  };

  const callerLevel = roleHierarchy[caller.role as keyof typeof roleHierarchy] || 0;
  const targetLevel = roleHierarchy[payload.role as keyof typeof roleHierarchy] || 0;

  // Cannot create a user with a role equal to or higher than your own (unless OWNER)
  if (caller.role !== 'OWNER' && targetLevel >= callerLevel) {
    throw ApiError.forbidden(`Your role (${caller.role}) cannot create a user with role ${payload.role}`);
  }

  // 2. Organization Scoping
  // If caller is PROMOTER, they can only create users in their own organization
  if (caller.role === 'PROMOTER') {
    // Fetch caller's organizationId if not in token (it's not currently in our jwt payload)
    const callerDetails = await prisma.user.findUnique({
      where: { id: caller.userId },
      select: { organizationId: true },
    });

    if (!callerDetails?.organizationId) {
      throw ApiError.forbidden('Your account must be associated with an organization to create users');
    }

    // Force organizationId to match caller's
    payload.organizationId = callerDetails.organizationId;
  } else if ((caller.role === 'ADMIN' || caller.role === 'OWNER') && !payload.organizationId) {
    // Optional: If Admin/Owner creates a user without orgId, it's a global user (like another Admin)
    // which is fine, but for PROMOTER level users, maybe we should enforce it?
    // Leaving as is for now to allow global Admins.
  }

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
  const caller = req.user!;

  // Security check: PROMOTERs can only list users in their organization
  if (caller.role === 'PROMOTER') {
    const callerDetails = await prisma.user.findUnique({
      where: { id: caller.userId },
      select: { organizationId: true },
    });

    if (!callerDetails?.organizationId) {
      throw ApiError.forbidden('Your account must be associated with an organization to list users');
    }

    // Force organizationId to match caller's
    query.organizationId = callerDetails.organizationId;
  }

  const result = await userService.listUsers(query);
  res.json(successResponse(result));
});
