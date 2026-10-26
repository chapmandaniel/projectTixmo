import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import { AuthRequest } from '../../middleware/auth';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { resolveOrganizationFilter, getActorScope } from '../../utils/tenantScope';

const ACTIONS = new Set(['SCANNER_REVOKE', 'EVENT_EDIT', 'EVENT_CANCEL', 'EVENT_STATUS']);

export const listStaffActions = catchAsync(async (req: AuthRequest, res: Response) => {
  const actor = await getActorScope(req);
  const query = req.query as Record<string, unknown>;
  const organizationId = resolveOrganizationFilter(
    actor,
    typeof query.organizationId === 'string' ? query.organizationId : undefined
  );
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const where: Prisma.StaffActionAuditWhereInput = {};
  if (organizationId) where.organizationId = organizationId;
  if (typeof query.subjectType === 'string' && query.subjectType)
    where.subjectType = query.subjectType;
  if (typeof query.subjectId === 'string' && query.subjectId) where.subjectId = query.subjectId;
  if (typeof query.action === 'string' && ACTIONS.has(query.action)) where.action = query.action;

  const [items, total] = await Promise.all([
    prisma.staffActionAudit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.staffActionAudit.count({ where }),
  ]);

  res.json(
    successResponse(
      items.map((item) => ({
        id: item.id,
        action: item.action,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        organizationId: item.organizationId,
        actorId: item.actorId,
        reason: item.reason,
        before: item.before,
        after: item.after,
        createdAt: item.createdAt,
      })),
      'Staff actions retrieved successfully',
      { page, limit, total, totalPages: Math.ceil(total / limit) }
    )
  );
});
