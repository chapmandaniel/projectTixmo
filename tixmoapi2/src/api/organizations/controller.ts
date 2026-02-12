import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import prisma from '../../config/prisma';
import { organizationService } from './service';

interface OrganizationWithUsers {
  id: string;
  users?: Array<{ id: string }>;
}

export const createOrganization = catchAsync(async (req: AuthRequest, res: Response) => {
  const payload = req.body as Parameters<typeof organizationService.createOrganization>[0];
  const organization = await organizationService.createOrganization(payload);
  res.status(201).json(successResponse(organization, 'Organization created successfully'));
});

export const getOrganization = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const organization = await organizationService.getOrganizationById(id);

  if (!organization) {
    throw ApiError.notFound('Organization not found');
  }

  res.json(successResponse(organization));
});

export const updateOrganization = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  // Check if user is admin or belongs to the organization
  const org = (await organizationService.getOrganizationById(id)) as OrganizationWithUsers | null;
  if (!org) {
    throw ApiError.notFound('Organization not found');
  }

  // Only admins and organization members can update
  if (req.user!.role !== 'ADMIN') {
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

  if (req.user!.role !== 'ADMIN') {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { organizationId: true },
    });

    if (!user || user.organizationId !== id) {
      throw ApiError.forbidden('You do not have permission to add members to this organization');
    }
  }

  await organizationService.addMember(id, userId);
  res.json(successResponse(null, 'Member added successfully'));
});

export const removeMember = catchAsync(async (req: AuthRequest, res: Response) => {
  const { id, userId } = req.params;

  if (req.user!.role !== 'ADMIN') {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { organizationId: true },
    });

    if (!user || user.organizationId !== id) {
      throw ApiError.forbidden(
        'You do not have permission to remove members from this organization'
      );
    }
  }

  await organizationService.removeMember(id, userId);
  res.json(successResponse(null, 'Member removed successfully'));
});
