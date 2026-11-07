import { TicketingMode } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError } from '../utils/ApiError';

/**
 * One capability list for vendor-sold events. The dashboard copy lives in
 * tdash/src/lib/ticketingMode.js and must list the same allowed names.
 * Anything not listed is refused for EXTERNAL events, including features
 * that do not exist yet.
 */
export const VENDOR_ALLOWED_CAPABILITIES = [
  'event_page',
  'venues',
  'approvals',
  'assets',
  'tasks',
  'analytics',
] as const;

export const isExternalTicketing = (event: { ticketingMode?: TicketingMode | null }) =>
  event.ticketingMode === TicketingMode.EXTERNAL;

export const vendorEventAllows = (
  event: { ticketingMode?: TicketingMode | null } | null | undefined,
  capability: string
): boolean => {
  if (!event || !isExternalTicketing(event)) return true;
  return (VENDOR_ALLOWED_CAPABILITIES as readonly string[]).includes(capability);
};

export const assertTicketingAllows = (
  event: { ticketingMode?: TicketingMode | null },
  capability: string
): void => {
  if (vendorEventAllows(event, capability)) return;
  throw ApiError.forbidden(
    'This event is sold by an external ticketing vendor. Tixmo does not offer this action for vendor-sold events.',
    { code: 'EXTERNAL_TICKETING', capability }
  );
};

export const assertEventCapability = async (eventId: string, capability: string): Promise<void> => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ticketingMode: true },
  });
  if (!event) return;
  assertTicketingAllows(event, capability);
};
