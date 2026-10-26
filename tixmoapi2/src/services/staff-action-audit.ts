import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

export type StaffAudit = {
  actorId: string;
  reason?: string | null;
};

export type StaffActionName =
  | 'SCANNER_REVOKE'
  | 'EVENT_EDIT'
  | 'EVENT_CANCEL'
  | 'EVENT_STATUS'
  | 'STAFF_PII_VIEW'
  | 'CHECK_IN';

export type StaffSubjectType = 'SCANNER' | 'EVENT' | 'TICKET' | 'ORDER';

export const staffReason = (value: unknown): string => {
  const reason = typeof value === 'string' ? value.trim() : '';
  return (reason || 'Not provided').slice(0, 1000);
};

type StaffActionInput = {
  action: StaffActionName;
  subjectType: StaffSubjectType;
  subjectId: string;
  organizationId: string;
  actorId: string;
  reason?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export async function recordStaffAction(db: Prisma.TransactionClient, input: StaffActionInput) {
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

export async function writeStaffAction(input: StaffActionInput) {
  return prisma.$transaction((tx) => recordStaffAction(tx, input));
}
