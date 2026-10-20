import prisma from '../config/prisma';
import { ApiError } from './ApiError';

export const isDisabledAccount = (user: { disabledAt?: Date | null; email: string }) =>
  Boolean(user.disabledAt) || /^deleted_.+@deleted\.com$/i.test(user.email);

export const hasValidStaffScope = (user: {
  role: string;
  organizationId?: string | null;
  isPlatformAdmin?: boolean;
}) => user.role !== 'ADMIN' || Boolean(user.organizationId) || user.isPlatformAdmin === true;

// Every authenticated entry point uses current authority, never the JWT role/org copy.
export const resolveAccountSession = async (payload: {
  userId: string;
  sessionVersion?: number;
}) => {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
      emailVerified: true,
      disabledAt: true,
      sessionVersion: true,
      isPlatformAdmin: true,
    },
  });
  if (
    !user ||
    isDisabledAccount(user) ||
    !hasValidStaffScope(user) ||
    !Number.isInteger(payload.sessionVersion) ||
    payload.sessionVersion !== user.sessionVersion
  ) {
    throw ApiError.unauthorized('Session is no longer valid');
  }
  return user;
};
