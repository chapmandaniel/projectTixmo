import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import prisma from '../../config/prisma';
import { organizationService } from './service';
import {
  ActorScope,
  assertOrganizationAccess,
  getActorScope,
  isGlobalAdmin,
} from '../../utils/tenantScope';

interface OrganizationWithUsers {
  id: string;
  users?: Array<{ id: string }>;
}

const isElevatedAdminRole = (role?: string) => role === 'OWNER' || role === 'ADMIN';
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
const canManageTargetRole = (actorRole?: string, targetRole?: string) =>
  actorRole === 'OWNER' || getRoleLevel(targetRole) < getRoleLevel(actorRole);

const memberActionMessage = (action: 'add' | 'remove', kind: 'membership' | 'privileges') => {
  if (kind === 'privileges') {
    return action === 'add'
      ? 'You do not have sufficient privileges to add members'
      : 'You do not have sufficient privileges to remove members';
  }

  return action === 'add'
    ? 'You do not have permission to add members to this organization'
    : 'You do not have permission to remove members from this organization';
};

// Platform-wide admins are the only role-only bypass. Everyone else must be an
// OWNER or ADMIN member of the organization named in the request.
const assertOrganizationMemberManager = (
  actor: ActorScope,
  organizationId: string,
  action: 'add' | 'remove'
) => {
  if (isGlobalAdmin(actor)) {
    return;
  }

  if (actor.organizationId !== organizationId) {
    throw ApiError.forbidden(memberActionMessage(action, 'membership'));
  }

  if (!isElevatedAdminRole(actor.role)) {
    throw ApiError.forbidden(memberActionMessage(action, 'privileges'));
  }
};

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

  const org = (await organizationService.getOrganizationById(id)) as OrganizationWithUsers | null;
  if (!org) {
    throw ApiError.notFound('Organization not found');
  }

  // Only a platform admin may update an organization without a member record.
  if (!isGlobalAdmin(actor)) {
    const usersRaw = (org as unknown as { users?: unknown }).users;
    const users = Array.isArray(usersRaw) ? (usersRaw as Array<{ id: string }>) : [];
    const isMember = users.some((u) => u.id === actor.userId);

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
  const actor = await getActorScope(req);
  const ownerOfTarget = actor.role === 'OWNER' && actor.organizationId === id;

  if (!isGlobalAdmin(actor) && !ownerOfTarget) {
    throw ApiError.forbidden('You do not have permission to delete this organization');
  }

  await organizationService.deleteOrganization(id);
  res.status(204).send();
});

export const listOrganizations = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  const requested = req.query as Parameters<typeof organizationService.listOrganizations>[0];
  if (!isGlobalAdmin(actor) && !actor.organizationId) {
    throw ApiError.forbidden("You do not have access to this organization's resources");
  }
  const result = await organizationService.listOrganizations({
    ...requested,
    id: isGlobalAdmin(actor) ? undefined : actor.organizationId || undefined,
  });
  res.json(successResponse(result));
});

export const addMember = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown> | undefined;
  const userId = body && typeof body['userId'] === 'string' ? body['userId'] : undefined;

  if (!userId) throw ApiError.badRequest('userId is required');

  const actor = await getActorScope(req);
  assertOrganizationMemberManager(actor, id, 'add');

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  if (!canManageTargetRole(actor.role, targetUser.role)) {
    throw ApiError.forbidden(
      `Your role (${actor.role}) cannot add a member with role ${targetUser.role}`
    );
  }

  await organizationService.addMember(id, userId);
  res.json(successResponse(null, 'Member added successfully'));
});

export const removeMember = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id, userId } = req.params;
  const actor = await getActorScope(req);
  assertOrganizationMemberManager(actor, id, 'remove');

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  if (!canManageTargetRole(actor.role, targetUser.role)) {
    throw ApiError.forbidden(
      `Your role (${actor.role}) cannot remove a member with role ${targetUser.role}`
    );
  }

  await organizationService.removeMember(id, userId);
  res.json(successResponse(null, 'Member removed successfully'));
});
