import {
  buyerEmailVisible,
  maskBarcode,
  presentOrderDetail,
} from '../src/api/orders/order-privacy';
import { presentScanResult } from '../src/api/scanners/public-scan';

const roles = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'PROMOTER',
  'TEAM_MEMBER',
  'SCANNER',
  'CUSTOMER',
] as const;
const emailRoles = new Set(['OWNER', 'ADMIN', 'MANAGER']);
const rawBarcode = 'TIX-RAW-SECRET-9999';
const order = {
  id: 'order-1',
  user: { email: 'buyer@example.com', firstName: 'Ada', lastName: 'Buyer' },
  tickets: [{ id: 'ticket-1', barcode: rawBarcode, qrCodeUrl: 'data:image/png;base64,secret' }],
};

describe('staff order detail privacy', () => {
  test.each(roles)('%s buyer email follows OWNER > ADMIN > MANAGER', (role) => {
    expect(buyerEmailVisible(role)).toBe(emailRoles.has(role));
    const presented = presentOrderDetail(order, role);
    if (emailRoles.has(role)) {
      expect(presented.user?.email).toBe('buyer@example.com');
    } else {
      expect(presented.user).toEqual({ firstName: 'Ada', lastName: 'Buyer' });
      expect(presented.user).not.toHaveProperty('email');
    }
    expect(presented.user?.firstName).toBe('Ada');
  });

  test('missing role hides the buyer email', () => {
    expect(presentOrderDetail(order, undefined).user).not.toHaveProperty('email');
    expect(presentOrderDetail(order, '').user).not.toHaveProperty('email');
  });

  test('masks raw barcodes to the last four characters', () => {
    expect(maskBarcode(rawBarcode)).toBe('••••9999');
    expect(maskBarcode('')).toBe('');
    expect(maskBarcode(null)).toBe('');
    expect(maskBarcode('abcd')).toBe('••••');
    expect(maskBarcode(rawBarcode)).not.toContain('TIX-RAW-SECRET');
  });
});

describe('scanner scan response', () => {
  const ticket = {
    barcode: rawBarcode,
    qrCodeUrl: 'data:image/png;base64,secret',
    ticketType: { name: 'QA GA (test)' },
    user: { firstName: 'Ada', lastName: 'Buyer', email: 'buyer@example.com' },
  };

  test('returns only the admission decision, reason, ticket type, and first name', () => {
    const presented = presentScanResult({
      success: true,
      reason: undefined,
      ticket,
    });
    expect(presented).toEqual({
      valid: true,
      reason: null,
      message: null,
      eventName: null,
      ticketTypeName: 'QA GA (test)',
      holderFirstName: 'Ada',
    });
    expect(Object.keys(presented).sort()).toEqual([
      'eventName',
      'holderFirstName',
      'message',
      'reason',
      'ticketTypeName',
      'valid',
    ]);
    const encoded = JSON.stringify(presented);
    expect(encoded).not.toContain(rawBarcode);
    expect(encoded).not.toContain('buyer@example.com');
    expect(encoded).not.toContain('Buyer');
    expect(encoded).not.toContain('scanLog');
  });

  test('keeps a denial reason without inventing a holder', () => {
    expect(
      presentScanResult({ success: false, reason: 'Ticket has been cancelled', ticket: null })
    ).toEqual({
      valid: false,
      reason: 'CANCELLED',
      message: 'Ticket has been cancelled',
      eventName: null,
      ticketTypeName: null,
      holderFirstName: null,
    });
  });
});
