import { z } from 'zod';

/**
 * Register scanner validation schema
 */
export const registerScannerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    deviceId: z.string().optional(),
    organizationId: z.string().uuid('Invalid organization ID'),
    eventId: z.string().uuid('Invalid event ID').optional(),
  }),
});

/**
 * Authenticate scanner validation schema
 */
export const authenticateScannerSchema = z.object({
  body: z.object({
    apiKey: z.string().min(1, 'API key is required'),
  }),
});

/**
 * List scanners validation schema
 */
export const listScannersSchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),
    status: z.enum(['ACTIVE', 'DISABLED', 'REVOKED']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

/**
 * Update scanner validation schema
 */
export const updateScannerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    status: z.enum(['ACTIVE', 'DISABLED', 'REVOKED']).optional(),
    eventId: z.string().uuid().nullable().optional(),
  }),
});

/**
 * Scan ticket validation schema
 */
export const scanTicketSchema = z.object({
  body: z.object({
    qrData: z.string().min(1, 'QR data is required'),
    scanType: z.enum(['ENTRY', 'EXIT', 'VALIDATION']).default('ENTRY'),
    metadata: z.record(z.unknown()).optional(),
  }),
});

/**
 * Get scan logs validation schema
 */
export const getScanLogsSchema = z.object({
  query: z.object({
    scannerId: z.string().uuid().optional(),
    ticketId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),
    success: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

/**
 * Sync tickets validation schema
 */
export const syncTicketsSchema = z.object({
  query: z.object({
    eventId: z.string().uuid().optional(),
    since: z.string().datetime().optional(), // For incremental sync
  }),
});

/**
 * Offline scan validation schema
 */
export const offlineScanSchema = z.object({
  body: z.object({
    scans: z
      .array(
        z.object({
          qrData: z.string().min(1),
          scannedAt: z.string().datetime(),
          scanType: z.enum(['ENTRY', 'EXIT', 'VALIDATION']).default('ENTRY'),
          metadata: z.record(z.unknown()).optional(),
        })
      )
      .min(1),
  }),
});
