import { Prisma } from '@prisma/client';

export type StaffAudit = {
  actorId: string;
  reason?: string | null;
};

export const staffReason = (value: unknown): string => {
  const reason = typeof value === 'string' ? value.trim() : '';
  return (reason || 'Not provided').slice(0, 1000);
};

export async function recordStaffAction(
  db: Prisma.TransactionClient,
  input: {
    action: 'SCANNER_REVOKE' | 'EVENT_EDIT' | 'EVENT_CANCEL' | 'EVENT_STATUS';
    subjectType: 'SCANNER' | 'EVENT';
    subjectId: string;
    organizationId: string;
    actorId: string;
    reason?: string | null;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  }
) {
  return db.staffActionAudit.create({
    data: {
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      organizationId: input.organizationId,
      actorId: input.actorId,
      reason: staffReason(input.reason),
      before: input.before,
      after: input.after,
    },
  });
}
