import { z } from 'zod';

// z.coerce.boolean treats every non-empty string, including "false", as true.
const queryBoolean = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
}, z.boolean());

/**
 * Register scanner validation schema
 */
export const registerScannerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    deviceId: z.string().optional(),
    organizationId: z.string().guid('Invalid organization ID'),
    eventId: z.string().guid('Invalid event ID').optional(),
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
    organizationId: z.string().guid('Invalid uuid').optional(),
    eventId: z.string().guid('Invalid uuid').optional(),
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
    eventId: z.string().guid('Invalid uuid').nullable().optional(),
  }),
});

/**
 * Scan ticket validation schema
 */
export const scanTicketSchema = z.object({
  body: z.object({
    qrData: z.string().min(1, 'QR data is required'),
    scanType: z.enum(['ENTRY', 'EXIT', 'VALIDATION']).default('ENTRY'),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

/**
 * Get scan logs validation schema
 */
export const getScanLogsSchema = z.object({
  query: z.object({
    scannerId: z.string().guid('Invalid uuid').optional(),
    ticketId: z.string().guid('Invalid uuid').optional(),
    eventId: z.string().guid('Invalid uuid').optional(),
    success: queryBoolean.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

/**
 * Sync tickets validation schema
 */
export const syncTicketsSchema = z.object({
  query: z.object({
    eventId: z.string().guid('Invalid uuid').optional(),
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
          metadata: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .min(1),
  }),
});
