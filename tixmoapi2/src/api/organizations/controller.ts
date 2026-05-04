import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import prisma from '../../config/prisma';
import { organizationService } from './service';
import { assertOrganizationAccess, getActorScope } from '../../utils/tenantScope';

interface OrganizationWithUsers {
  id: string;
  users?: Array<{ id: string }>;
}

const isElevatedAdminRole = (role?: string) => role === 'OWNER' || role === 'ADMIN';
const isOrganizationManagerRole = (role?: string) => role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
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
const canManageTargetRole = (actorRole?: string, targetRole?: string) => actorRole === 'OWNER' || getRoleLevel(targetRole) < getRoleLevel(actorRole);

export const createOrganization = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as Parameters<typeof organizationService.createOrganization>[0];
  const organization = await organizationService.createOrganization(payload);
  res.status(201).json(successResponse(organization, 'Organization created successfully'));
});

export const getOrganization = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const actor = await getActorScope(req);
  assertOrganizationAccess(actor, id);

  const organization = await organizationService.getOrganizationById(id);

  if (!organization) {
    throw ApiError.notFound('Organization not found');
  }

  res.json(successResponse(organization));
});

export const updateOrganization = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const actor = await getActorScope(req);
  assertOrganizationAccess(actor, id);

  // Check if user is admin or belongs to the organization
  const org = (await organizationService.getOrganizationById(id)) as OrganizationWithUsers | null;
  if (!org) {
    throw ApiError.notFound('Organization not found');
  }

  // Only admins and organization members can update
  if (!isElevatedAdminRole(req.user!.role)) {
    // Check if user is a member of the organization
    const usersRaw = (org as unknown as { users?: unknown }).users;
    const users = Array.isArray(usersRaw) ? (usersRaw as Array<{ id: string }>) : [];
    const isMember = users.some((u) => u.id === req.user!.userId);

    if (!isMember) {
      throw ApiError.forbidden('You do not have permission to update this organization');
    }
  }

  const organization = await organizationService.updateOrganization(
    id,
    req.body as Parameters<typeof organizationService.updateOrganization>[1]
  );
  res.json(successResponse(organization, 'Organization updated successfully'));
});

export const deleteOrganization = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  await organizationService.deleteOrganization(id);
  res.status(204).send();
});

export const listOrganizations = catchAsync(async (req: AuthRequest, res: Response) => {
  const result = await organizationService.listOrganizations(req.query);
  res.json(successResponse(result));
});

export const addMember = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown> | undefined;
  const userId = body && typeof body['userId'] === 'string' ? body['userId'] : undefined;

  if (!userId) throw ApiError.badRequest('userId is required');

  if (!isElevatedAdminRole(req.user!.role)) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { organizationId: true, role: true },
    });

    if (!user || user.organizationId !== id) {
      throw ApiError.forbidden('You do not have permission to add members to this organization');
    }

    if (!isOrganizationManagerRole(user.role)) {
      throw ApiError.forbidden('You do not have sufficient privileges to add members');
    }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  if (!canManageTargetRole(req.user!.role, targetUser.role)) {
    throw ApiError.forbidden(`Your role (${req.user!.role}) cannot add a member with role ${targetUser.role}`);
  }

  await organizationService.addMember(id, userId);
  res.json(successResponse(null, 'Member added successfully'));
});

export const removeMember = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id, userId } = req.params;

  if (!isElevatedAdminRole(req.user!.role)) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { organizationId: true, role: true },
    });

    if (!user || user.organizationId !== id) {
      throw ApiError.forbidden(
        'You do not have permission to remove members from this organization'
      );
    }

    if (!isOrganizationManagerRole(user.role)) {
      throw ApiError.forbidden('You do not have sufficient privileges to remove members');
    }
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  if (!canManageTargetRole(req.user!.role, targetUser.role)) {
    throw ApiError.forbidden(`Your role (${req.user!.role}) cannot remove a member with role ${targetUser.role}`);
  }

  await organizationService.removeMember(id, userId);
  res.json(successResponse(null, 'Member removed successfully'));
});
