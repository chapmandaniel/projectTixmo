import { UserRole } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { ApiError } from './ApiError';

export interface ActorScope {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
}

export const isGlobalAdmin = (actor: ActorScope) =>
  actor.role === UserRole.ADMIN && !actor.organizationId;

export const getActorScope = async (req: AuthRequest): Promise<ActorScope> => {
  if (!req.user?.userId) {
    throw ApiError.unauthorized('Authentication required');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
    },
  });

  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };
};

export const requireOrganizationId = (
  actor: ActorScope,
  requestedOrganizationId?: string | null
) => {
  if (isGlobalAdmin(actor)) {
    if (!requestedOrganizationId) {
      throw ApiError.badRequest('organizationId is required for global administrators');
    }

    return requestedOrganizationId;
  }

  if (!actor.organizationId) {
    throw ApiError.forbidden('User does not belong to an organization');
  }

  if (requestedOrganizationId && requestedOrganizationId !== actor.organizationId) {
    throw ApiError.forbidden("You do not have access to this organization's resources");
  }

  return actor.organizationId;
};

export const resolveOrganizationFilter = (
  actor: ActorScope,
  requestedOrganizationId?: string | null
) => {
  if (isGlobalAdmin(actor)) {
    return requestedOrganizationId || undefined;
  }

  return requireOrganizationId(actor, requestedOrganizationId);
};

export const assertOrganizationAccess = (actor: ActorScope, organizationId: string) => {
  if (isGlobalAdmin(actor)) {
    return;
  }

  if (!actor.organizationId || organizationId !== actor.organizationId) {
    throw ApiError.forbidden("You do not have access to this organization's resources");
  }
};

export const assertEventAccess = async (actor: ActorScope, eventId: string) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizationId: true },
  });

  if (!event) {
    throw ApiError.notFound('Event not found');
  }

  assertOrganizationAccess(actor, event.organizationId);
  return event;
};

export const assertVenueAccess = async (actor: ActorScope, venueId: string) => {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, organizationId: true },
  });

  if (!venue) {
    throw ApiError.notFound('Venue not found');
  }

  assertOrganizationAccess(actor, venue.organizationId);
  return venue;
};

export const assertVenueBelongsToOrganization = async (venueId: string, organizationId: string) => {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, organizationId: true },
  });

  if (!venue) {
    throw ApiError.notFound('Venue not found');
  }

  if (venue.organizationId !== organizationId) {
    throw ApiError.badRequest('Venue does not belong to the specified organization');
  }

  return venue;
};

export const assertTicketTypeAccess = async (actor: ActorScope, ticketTypeId: string) => {
  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: {
      id: true,
      event: { select: { id: true, organizationId: true } },
    },
  });

  if (!ticketType) {
    throw ApiError.notFound('Ticket type not found');
  }

  assertOrganizationAccess(actor, ticketType.event.organizationId);
  return ticketType;
};

export const assertTicketTierAccess = async (actor: ActorScope, tierId: string) => {
  const tier = await prisma.ticketTier.findUnique({
    where: { id: tierId },
    select: {
      id: true,
      ticketType: {
        select: {
          id: true,
          event: { select: { id: true, organizationId: true } },
        },
      },
    },
  });

  if (!tier) {
    throw ApiError.notFound('Ticket tier not found');
  }

  assertOrganizationAccess(actor, tier.ticketType.event.organizationId);
  return tier;
};

export const assertPromoCodeAccess = async (actor: ActorScope, promoCodeId: string) => {
  const promoCode = await prisma.promoCode.findUnique({
    where: { id: promoCodeId },
    select: { id: true, organizationId: true },
  });

  if (!promoCode) {
    throw ApiError.notFound('Promo code not found');
  }

  assertOrganizationAccess(actor, promoCode.organizationId);
  return promoCode;
};

export const assertScannerAccess = async (actor: ActorScope, scannerId: string) => {
  const scanner = await prisma.scanner.findUnique({
    where: { id: scannerId },
    select: { id: true, organizationId: true },
  });

  if (!scanner) {
    throw ApiError.notFound('Scanner not found');
  }

  assertOrganizationAccess(actor, scanner.organizationId);
  return scanner;
};
