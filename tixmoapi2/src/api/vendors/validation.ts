import { z } from 'zod';

const venueId = z.string().trim().min(1).max(64);
const mapping = z.object({
  externalTicketTypeId: z.string().trim().min(1).max(64),
  tierName: z.string().trim().min(1).max(120),
});

export const connectShowpassSchema = z.object({
  params: z.object({ organizationId: z.string().guid('Invalid uuid') }),
  body: z.object({
    apiKey: z.string().trim().min(8).max(500),
    vendorVenueId: venueId,
    webhookSecret: z.string().trim().min(8).max(200).optional(),
  }),
});

export const showpassVenueSchema = z.object({
  params: z.object({ organizationId: z.string().guid('Invalid uuid') }),
  query: z.object({ vendorVenueId: venueId }),
});

export const saveShowpassConfigSchema = z.object({
  params: z.object({ organizationId: z.string().guid('Invalid uuid') }),
  body: z.object({
    vendorVenueId: venueId,
    currency: z.string().trim().length(3).optional(),
    timezone: z.string().trim().min(1).max(80).nullable().optional(),
    syncIntervalMinutes: z.number().int().min(15).max(10080).optional(),
    vendorOwnedFields: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
    ticketTypeMappings: z.array(mapping).max(200).optional(),
    webhookSecret: z.string().trim().min(8).max(200).optional(),
  }),
});

export const importShowpassSchema = z.object({
  params: z.object({ organizationId: z.string().guid('Invalid uuid') }),
  body: z.object({
    vendorVenueId: venueId,
    externalItemIds: z.array(z.string().trim().min(1).max(64)).min(1).max(100),
  }),
});

export const syncShowpassSchema = z.object({
  params: z.object({ organizationId: z.string().guid('Invalid uuid') }),
});

export const soldCountsSchema = z.object({
  params: z.object({ organizationId: z.string().guid('Invalid uuid') }),
  query: z.object({
    eventId: z.string().guid('Invalid uuid').optional(),
  }),
});
