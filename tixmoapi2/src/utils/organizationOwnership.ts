import { Prisma } from '@prisma/client';
import { ApiError } from './ApiError';

export const LAST_OWNER_GUARD_MESSAGE =
  'Cannot remove the last owner of an organization. Assign another owner first.';

/**
 * Refuse dropping OWNER on the organization's last remaining owner.
 * Locks the organization row so concurrent removals cannot both observe count > 1.
 */
export async function assertCanRelinquishOrganizationOwnership(
  tx: Prisma.TransactionClient,
  current: { role: string; organizationId: string | null },
  next: { role?: string; organizationId?: string | null } = {}
): Promise<void> {
  if (current.role !== 'OWNER' || !current.organizationId) {
    return;
  }

  const nextRole = next.role ?? current.role;
  const nextOrganizationId =
    next.organizationId === undefined ? current.organizationId : next.organizationId;
  if (nextRole === 'OWNER' && nextOrganizationId === current.organizationId) {
    return;
  }

  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${current.organizationId} FOR UPDATE`;
  const ownerCount = await tx.user.count({
    where: {
      organizationId: current.organizationId,
      role: 'OWNER',
    },
  });

  if (ownerCount <= 1) {
    throw ApiError.badRequest(LAST_OWNER_GUARD_MESSAGE);
  }
}
