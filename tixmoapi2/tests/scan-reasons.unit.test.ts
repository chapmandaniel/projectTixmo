import {
  presentScanResult,
  SCAN_REASON,
  VOID_DISPUTED_MESSAGE,
} from '../src/api/scanners/public-scan';
import { DOORS_BEFORE_START_MS, ticketFailure } from '../src/services/ticket-admission.service';

const secretBarcode = 'TIX-SECRET-SHOULD-NOT-RENDER';
const start = new Date('2026-10-26T20:00:00.000Z');

const gateTicket = (overrides: Record<string, unknown> = {}) => ({
  status: 'VALID',
  barcode: secretBarcode,
  qrCodeUrl: 'data:image/png;base64,secret',
  order: { status: 'PAID', refundStatus: 'NONE' },
  event: {
    name: 'Harbour Night',
    deletedAt: null,
    status: 'PUBLISHED',
    startDatetime: start,
    endDatetime: new Date('2026-10-26T23:00:00.000Z'),
  },
  ticketType: { name: 'GA' },
  user: { firstName: 'Ada', lastName: 'Buyer', email: 'buyer@example.com' },
  ...overrides,
});

describe('scan reason codes', () => {
  test('WRONG_EVENT includes the event name and hides the credential', () => {
    const presented = presentScanResult({
      success: false,
      reason: 'WRONG_EVENT',
      ticket: gateTicket(),
    });
    expect(presented).toEqual({
      valid: false,
      reason: SCAN_REASON.WRONG_EVENT,
      message: 'This ticket is for Harbour Night.',
      eventName: 'Harbour Night',
      ticketTypeName: 'GA',
      holderFirstName: 'Ada',
    });
    const encoded = JSON.stringify(presented);
    expect(encoded).not.toContain(secretBarcode);
    expect(encoded).not.toContain('buyer@example.com');
    expect(encoded).not.toContain('Buyer');
  });

  test('VOID_DISPUTED follows the dispute flag whatever the ticket status is named', () => {
    const presented = presentScanResult({
      success: false,
      reason: 'Ticket credential must be reissued',
      ticket: gateTicket({
        status: 'WHATEVER_THEY_NAME_IT',
        order: { status: 'PAID', refundStatus: 'DISPUTE_LOST' },
      }),
    });
    expect(presented.reason).toBe(SCAN_REASON.VOID_DISPUTED);
    expect(presented.message).toBe(VOID_DISPUTED_MESSAGE);
    expect(presented.eventName).toBeNull();
    expect(JSON.stringify(presented)).not.toContain(secretBarcode);
  });

  test('VOID_DISPUTED also follows a dispute reason string', () => {
    const presented = presentScanResult({
      success: false,
      reason: 'Ticket voided: payment disputed',
      ticket: gateTicket({ status: 'CANCELLED' }),
    });
    expect(presented.reason).toBe(SCAN_REASON.VOID_DISPUTED);
    expect(presented.message).toBe('VOID: disputed, see gate lead');
  });

  test('REFUNDED wins over a cancelled ticket on a refunded order', () => {
    const presented = presentScanResult({
      success: false,
      reason: 'Ticket has been cancelled',
      ticket: gateTicket({
        status: 'CANCELLED',
        order: { status: 'REFUNDED', refundStatus: 'SUCCEEDED' },
      }),
    });
    expect(presented.reason).toBe(SCAN_REASON.REFUNDED);
    expect(presented.message).toBe('This ticket was refunded.');
  });

  test('CANCELLED stays distinct from a refund or a dispute', () => {
    const presented = presentScanResult({
      success: false,
      reason: 'Ticket has been cancelled',
      ticket: gateTicket({ status: 'CANCELLED' }),
    });
    expect(presented.reason).toBe(SCAN_REASON.CANCELLED);
    expect(presented.message).toBe('Ticket has been cancelled');
  });
});

describe('attendee doors time', () => {
  const admission = () => gateTicket() as Parameters<typeof ticketFailure>[0];

  afterEach(() => {
    jest.useRealTimers();
  });

  test('check-in is allowed from two hours before start and blocked before that', () => {
    const ticket = admission();
    jest.useFakeTimers();
    jest.setSystemTime(start.getTime() - DOORS_BEFORE_START_MS - 1000);
    expect(ticketFailure(ticket, true, true)).toBe('Event has not started yet');

    jest.setSystemTime(start.getTime() - DOORS_BEFORE_START_MS);
    expect(ticketFailure(ticket, true, true)).toBeUndefined();

    jest.setSystemTime(start.getTime() - 60 * 60 * 1000);
    expect(ticketFailure(ticket, true, true)).toBeUndefined();
  });

  test('a disputed order is denied before doors and before a cancelled reading', () => {
    const ticket = admission();
    ticket.order.refundStatus = 'DISPUTED';
    ticket.status = 'VALID';
    jest.useFakeTimers();
    jest.setSystemTime(start.getTime() - DOORS_BEFORE_START_MS - 1000);
    expect(ticketFailure(ticket, true, true)).toBe(VOID_DISPUTED_MESSAGE);
  });
});
