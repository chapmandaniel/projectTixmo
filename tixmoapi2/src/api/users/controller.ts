import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { userService, CreateUserInput, UpdateUserInput, ListUsersParams } from './service';
import prisma from '../../config/prisma';
import { resolveTrustedClientOrigin } from '../../utils/clientOrigin';

const getCallerOrganizationId = async (userId: string) => {
  const callerDetails = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  return callerDetails?.organizationId ?? null;
};

const roleHierarchy = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  PROMOTER: 2,
  TEAM_MEMBER: 1,
  SCANNER: 1,
  CUSTOMER: 0,
};

const getRoleLevel = (role?: string) => roleHierarchy[role as keyof typeof roleHierarchy] ?? 0;

export const createUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as CreateUserInput;
  const caller = req.user!;

  // 1. Role Hierarchy Check
  const callerLevel = getRoleLevel(caller.role);
  const targetLevel = getRoleLevel(payload.role);

  // Cannot create a user with a role equal to or higher than your own (unless OWNER)
  if (caller.role !== 'OWNER' && targetLevel >= callerLevel) {
    throw ApiError.forbidden(`Your role (${caller.role}) cannot create a user with role ${payload.role}`);
  }

  // 2. Organization Scoping
  // Organization-scoped operators can only create users in their own organization.
  if (caller.role === 'MANAGER' || caller.role === 'PROMOTER') {
    const callerOrganizationId = await getCallerOrganizationId(caller.userId);

    if (!callerOrganizationId) {
      throw ApiError.forbidden('Your account must be associated with an organization to create users');
    }

    // Force organizationId to match caller's
    payload.organizationId = callerOrganizationId;
  } else if ((caller.role === 'ADMIN' || caller.role === 'OWNER') && !payload.organizationId) {
    const callerOrganizationId = await getCallerOrganizationId(caller.userId);

    // Team dashboard invites omit organizationId, so inherit the caller's organization
    // when one exists. Global admins without an organization still retain the ability
    // to create unscoped users intentionally.
    if (callerOrganizationId) {
      payload.organizationId = callerOrganizationId;
    }
  }

  const clientOrigin = resolveTrustedClientOrigin(req.get('origin'), req.get('referer'));
  const user = await userService.createUser(payload, { clientOrigin });
  res.status(201).json(successResponse(user, 'User created successfully'));
});

export const getUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const user = await userService.getUserById(id);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Users can only view their own profile unless they're an elevated admin role.
  if (req.user!.userId !== id && req.user!.role !== 'ADMIN' && req.user!.role !== 'OWNER') {
    throw ApiError.forbidden('You can only view your own profile');
  }

  res.json(successResponse(user));
});

export const updateUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Users can only update their own profile unless they're an elevated admin role.
  if (req.user!.userId !== id && req.user!.role !== 'ADMIN' && req.user!.role !== 'OWNER') {
    throw ApiError.forbidden('You can only update your own profile');
  }

  const payload = req.body as UpdateUserInput;
  const user = await userService.updateUser(id, payload);
  res.json(successResponse(user, 'User updated successfully'));
});

export const deleteUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const caller = req.user!;

  if (caller.role !== 'OWNER') {
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!targetUser) {
      throw ApiError.notFound('User not found');
    }

    if (getRoleLevel(targetUser.role) >= getRoleLevel(caller.role)) {
      throw ApiError.forbidden(`Your role (${caller.role}) cannot delete a user with role ${targetUser.role}`);
    }
  }

  await userService.deleteUser(id);
  res.status(204).send();
});

export const listUsers = catchAsync(async (req: AuthRequest, res: Response) => {
  const query = req.query as unknown as ListUsersParams;
  const caller = req.user!;

  // Security check: organization-scoped operators can only list users in their organization
  if (caller.role === 'MANAGER' || caller.role === 'PROMOTER') {
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
