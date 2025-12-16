import { z } from 'zod';

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    unreadOnly: z.enum(['true', 'false']).optional(),
  }),
});

export const updatePreferencesSchema = z.object({
  body: z.object({
    emailOrderConfirm: z.boolean().optional(),
    emailTicketTransfer: z.boolean().optional(),
    emailEventReminder: z.boolean().optional(),
    emailPromo: z.boolean().optional(),
    emailAnnouncement: z.boolean().optional(),
    smsOrderConfirm: z.boolean().optional(),
    smsEventReminder: z.boolean().optional(),
  }),
});
