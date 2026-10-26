// Gate devices only need an admit/deny decision, why, the ticket type, and a
// first name. The raw barcode and the buyer's email stay on the server.
// `reason` is a stable code. `message` is the text to show. `eventName` is set
// only for WRONG_EVENT.

export const SCAN_REASON = {
  WRONG_EVENT: 'WRONG_EVENT',
  VOID_DISPUTED: 'VOID_DISPUTED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
  ALREADY_USED: 'ALREADY_USED',
  REISSUE_REQUIRED: 'REISSUE_REQUIRED',
  UNPAID: 'UNPAID',
  REFUND_PENDING: 'REFUND_PENDING',
  EVENT_INACTIVE: 'EVENT_INACTIVE',
  NOT_STARTED: 'NOT_STARTED',
  EVENT_ENDED: 'EVENT_ENDED',
  INVALID_QR: 'INVALID_QR',
  NOT_FOUND: 'NOT_FOUND',
  CREDENTIAL_INVALID: 'CREDENTIAL_INVALID',
  ADMITTED: 'ADMITTED',
  REVOKED: 'REVOKED',
} as const;

export const VOID_DISPUTED_MESSAGE = 'VOID: disputed, see gate lead';

export interface PublicScanResult {
  valid: boolean;
  reason: string | null;
  message: string | null;
  eventName: string | null;
  ticketTypeName: string | null;
  holderFirstName: string | null;
}

const KNOWN: Record<string, { reason: string; message: string }> = {
  'Ticket has been cancelled': {
    reason: SCAN_REASON.CANCELLED,
    message: 'Ticket has been cancelled',
  },
  'Ticket has already been used': {
    reason: SCAN_REASON.ALREADY_USED,
    message: 'Ticket has already been used',
  },
  'Ticket credential must be reissued': {
    reason: SCAN_REASON.REISSUE_REQUIRED,
    message: 'Ticket credential must be reissued',
  },
  'Ticket is not valid until payment is completed': {
    reason: SCAN_REASON.UNPAID,
    message: 'Ticket is not valid until payment is completed',
  },
  'Ticket has a refund in progress': {
    reason: SCAN_REASON.REFUND_PENDING,
    message: 'Ticket has a refund in progress',
  },
  'Event is not active for scanning': {
    reason: SCAN_REASON.EVENT_INACTIVE,
    message: 'Event is not active for scanning',
  },
  'Event has not started yet': {
    reason: SCAN_REASON.NOT_STARTED,
    message: 'Event has not started yet',
  },
  'Event has already ended': {
    reason: SCAN_REASON.EVENT_ENDED,
    message: 'Event has already ended',
  },
  'Invalid QR code format': { reason: SCAN_REASON.INVALID_QR, message: 'Invalid QR code format' },
  'Ticket not found': { reason: SCAN_REASON.NOT_FOUND, message: 'Ticket not found' },
  'Ticket credential is no longer valid': {
    reason: SCAN_REASON.CREDENTIAL_INVALID,
    message: 'Ticket credential is no longer valid',
  },
  'Scanner is not assigned to this event': {
    reason: SCAN_REASON.WRONG_EVENT,
    message: '',
  },
  'Ticket voided: payment disputed': {
    reason: SCAN_REASON.VOID_DISPUTED,
    message: VOID_DISPUTED_MESSAGE,
  },
  [VOID_DISPUTED_MESSAGE]: {
    reason: SCAN_REASON.VOID_DISPUTED,
    message: VOID_DISPUTED_MESSAGE,
  },
  [SCAN_REASON.VOID_DISPUTED]: {
    reason: SCAN_REASON.VOID_DISPUTED,
    message: VOID_DISPUTED_MESSAGE,
  },
  [SCAN_REASON.WRONG_EVENT]: { reason: SCAN_REASON.WRONG_EVENT, message: '' },
  [SCAN_REASON.REFUNDED]: {
    reason: SCAN_REASON.REFUNDED,
    message: 'This ticket was refunded.',
  },
  [SCAN_REASON.CANCELLED]: {
    reason: SCAN_REASON.CANCELLED,
    message: 'Ticket has been cancelled',
  },
};

const nestedString = (source: unknown, key: string, field: string): string | null => {
  if (!source || typeof source !== 'object') return null;
  const child = (source as Record<string, unknown>)[key];
  if (!child || typeof child !== 'object') return null;
  const value = (child as Record<string, unknown>)[field];
  return typeof value === 'string' && value ? value : null;
};

const ownString = (source: unknown, key: string): string | null => {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
};

const nestedRecord = (source: unknown, key: string): unknown => {
  if (!source || typeof source !== 'object') return null;
  return (source as Record<string, unknown>)[key];
};

// The dispute handler flags the order instead of inventing a ticket status.
// DISPUTED and any DISPUTE_* outcome count, whatever the ticket status is named.
const orderDisputed = (ticket: unknown): boolean => {
  const refundStatus = nestedString(ticket, 'order', 'refundStatus');
  return refundStatus === 'DISPUTED' || Boolean(refundStatus?.startsWith('DISPUTE_'));
};

const reasonDisputed = (reason: string | null): boolean => {
  if (!reason) return false;
  if (reason === SCAN_REASON.VOID_DISPUTED || reason === VOID_DISPUTED_MESSAGE) return true;
  if (reason === 'Ticket voided: payment disputed') return true;
  return /disput/i.test(reason);
};

export const wrongEventMessage = (eventName: string | null): string =>
  eventName ? `This ticket is for ${eventName}.` : 'This ticket is for another event.';

const classify = (
  rawReason: string | null,
  ticket: unknown
): { reason: string; message: string } => {
  if (reasonDisputed(rawReason) || orderDisputed(ticket)) {
    return { reason: SCAN_REASON.VOID_DISPUTED, message: VOID_DISPUTED_MESSAGE };
  }
  if (
    rawReason === SCAN_REASON.WRONG_EVENT ||
    rawReason === 'Scanner is not assigned to this event'
  ) {
    return {
      reason: SCAN_REASON.WRONG_EVENT,
      message: wrongEventMessage(ownString(nestedRecord(ticket, 'event'), 'name')),
    };
  }
  const orderStatus = nestedString(ticket, 'order', 'status');
  if (
    orderStatus === 'REFUNDED' ||
    rawReason === SCAN_REASON.REFUNDED ||
    /refunded/i.test(rawReason || '')
  ) {
    return { reason: SCAN_REASON.REFUNDED, message: 'This ticket was refunded.' };
  }
  const ticketStatus = ownString(ticket, 'status');
  if (
    ticketStatus === 'CANCELLED' ||
    rawReason === SCAN_REASON.CANCELLED ||
    rawReason === 'Ticket has been cancelled'
  ) {
    return { reason: SCAN_REASON.CANCELLED, message: 'Ticket has been cancelled' };
  }
  if (rawReason && KNOWN[rawReason]) return KNOWN[rawReason];
  return { reason: rawReason || 'UNKNOWN', message: rawReason || 'Admission denied' };
};

export const presentScanResult = (result: {
  success?: boolean;
  reason?: string | null;
  ticket?: unknown;
}): PublicScanResult => {
  const ticket = result?.ticket;
  const ticketTypeName = nestedString(ticket, 'ticketType', 'name');
  const holderFirstName = nestedString(ticket, 'user', 'firstName');
  if (result?.success === true) {
    return {
      valid: true,
      reason: null,
      message: null,
      eventName: null,
      ticketTypeName,
      holderFirstName,
    };
  }
  const denial = classify(result?.reason ?? null, ticket);
  return {
    valid: false,
    reason: denial.reason,
    message: denial.message,
    eventName:
      denial.reason === SCAN_REASON.WRONG_EVENT
        ? ownString(nestedRecord(ticket, 'event'), 'name')
        : null,
    ticketTypeName,
    holderFirstName,
  };
};

// Persisted on scan_logs.failure_reason. Admitted scans use ADMITTED.
// NOT_STARTED is the doors denial. REFUNDED is the refunded-order denial.
export const recordedScanReason = (result: {
  success?: boolean;
  reason?: string | null;
  ticket?: unknown;
}): string => {
  if (result.success === true) return SCAN_REASON.ADMITTED;
  return (
    presentScanResult({ success: false, reason: result.reason, ticket: result.ticket }).reason ||
    'UNKNOWN'
  );
};
