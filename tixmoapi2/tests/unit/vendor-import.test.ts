import { readFileSync } from 'fs';
import path from 'path';
import { createHmac } from 'crypto';
import {
  assertTicketingAllows,
  VENDOR_ALLOWED_CAPABILITIES,
  vendorEventAllows,
} from '../../src/services/ticketing-mode';
import {
  classifyVendorEvent,
  eventFingerprint,
  parseDiscoveryEvent,
} from '../../src/services/vendors/discovery';
import {
  countedInvoiceHasBuyerData,
  countInvoice,
} from '../../src/services/vendors/invoice-counts';
import { shiftIsoPreservingLocalTime } from '../../src/services/vendors/fixture-clock';
import { createVendorAdapter } from '../../src/services/vendors/registry';
import { FixtureShowpassAdapter } from '../../src/services/vendors/showpass-fixture';
import { showpassSignature } from '../../src/services/vendors/showpass-signature';
import { VendorAuthError } from '../../src/services/vendors/types';
import {
  decryptVendorSecret,
  encryptVendorSecret,
} from '../../src/services/vendor-credential-crypto';

const fixtureRoot = path.resolve(__dirname, '../../fixtures/showpass');
const read = (file: string) => JSON.parse(readFileSync(path.join(fixtureRoot, file), 'utf8'));

describe('vendor ticketing mode', () => {
  it('allows the shared capability list and refuses everything else on external events', () => {
    const external = { ticketingMode: 'EXTERNAL' as const };
    const tixmo = { ticketingMode: 'TIXMO' as const };
    for (const capability of VENDOR_ALLOWED_CAPABILITIES) {
      expect(vendorEventAllows(external, capability)).toBe(true);
    }
    for (const capability of [
      'checkout',
      'orders',
      'tickets',
      'wallet_passes',
      'scanners',
      'scan',
      'refunds',
      'transfers',
      'promo_codes',
      'waitlists',
      'attendees',
      'buyer_emails',
      'security_monitoring',
    ]) {
      expect(vendorEventAllows(external, capability)).toBe(false);
      expect(vendorEventAllows(tixmo, capability)).toBe(true);
    }
    expect(() => assertTicketingAllows(external, 'promo_codes')).toThrow(
      /external ticketing vendor/
    );
  });

  it('matches the dashboard capability list', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../../tdash/src/lib/ticketingMode.js'),
      'utf8'
    );
    const match = source.match(/VENDOR_ALLOWED_CAPABILITIES = \[([\s\S]*?)\]/);
    const names = [...(match?.[1].matchAll(/'([^']+)'/g) || [])].map((item) => item[1]);
    expect(names).toEqual([...VENDOR_ALLOWED_CAPABILITIES]);
  });
});

describe('showpass discovery fixtures', () => {
  const files = [
    'events/polygon-halloween.json',
    'events/pumpkins-dublin.json',
    'events/giants-recurring-parent.json',
    'events/mardi-gras.json',
    'events/mardi-gras.changed.json',
  ];

  it.each(files)('parses %s into the documented discovery shape', (file) => {
    const event = parseDiscoveryEvent(read(file));
    expect(event).not.toBeNull();
    expect(event?.fixtureId).toMatch(/^sp-evt-\d+$/);
    expect(event?.timezone).toBeTruthy();
    expect(event?.purchaseUrl.startsWith('https://www.showpass.com/')).toBe(true);
    expect(event?.ticketTypes.length).toBeGreaterThan(0);
  });

  it('keeps Europe/Dublin and the recurring parent', () => {
    const dublin = parseDiscoveryEvent(read('events/pumpkins-dublin.json'));
    const parent = parseDiscoveryEvent(read('events/giants-recurring-parent.json'));
    expect(dublin?.timezone).toBe('Europe/Dublin');
    expect(dublin?.fixtureId).toBe('sp-evt-1545631');
    expect(parent?.isRecurringParent).toBe(true);
    expect(parent?.fixtureId).toBe('sp-evt-1530323');
  });

  it('classifies new, existing, and changed fingerprints', () => {
    const baseline = parseDiscoveryEvent(read('events/mardi-gras.json'));
    const changed = parseDiscoveryEvent(read('events/mardi-gras.changed.json'));
    expect(baseline && changed).toBeTruthy();
    const before = eventFingerprint(baseline!);
    const after = eventFingerprint(changed!);
    expect(before).not.toBe(after);
    expect(classifyVendorEvent(after, null)).toBe('new');
    expect(classifyVendorEvent(after, after)).toBe('existing');
    expect(classifyVendorEvent(after, before)).toBe('changed');
    const revised = changed!.ticketTypes.find((ticket) => ticket.externalId === '4581610');
    expect(revised?.price).toBe('30.00');
  });

  it('changes mardi gras name, start, and price while the timezone id stays the same', () => {
    const baseline = parseDiscoveryEvent(read('events/mardi-gras.json'));
    const changed = parseDiscoveryEvent(read('events/mardi-gras.changed.json'));
    expect(baseline && changed).toBeTruthy();
    expect(changed!.name).not.toBe(baseline!.name);
    expect(changed!.startsOn).toBe('2026-10-31T22:30:00Z');
    expect(baseline!.startsOn).toBe('2026-10-31T21:30:00Z');
    expect(changed!.timezone).toBe('Canada/Newfoundland');
    expect(changed!.timezone).toBe(baseline!.timezone);
    const before = baseline!.ticketTypes.find((ticket) => ticket.externalId === '4581610');
    const after = changed!.ticketTypes.find((ticket) => ticket.externalId === '4581610');
    expect(before?.price).toBe('25.00');
    expect(after?.price).toBe('30.00');
    expect(after?.name).not.toBe(before?.name);
  });

  it('keeps Mardi Gras local time and lands the shifted current start at 23:30Z', () => {
    const baseline = parseDiscoveryEvent(read('events/mardi-gras.json'));
    const changed = parseDiscoveryEvent(read('events/mardi-gras.changed.json'));
    const dublin = parseDiscoveryEvent(read('events/pumpkins-dublin.json'));
    const polygon = parseDiscoveryEvent(read('events/polygon-halloween.json'));
    const giants = parseDiscoveryEvent(read('events/giants-recurring-parent.json'));
    expect(dublin?.currency).toBe('EUR');
    expect(baseline?.currency).toBe('CAD');
    expect(changed?.currency).toBe('CAD');
    expect(polygon?.currency).toBe('CAD');
    expect(giants?.currency).toBe('CAD');
    const baseShift = shiftIsoPreservingLocalTime(baseline!.startsOn, baseline!.timezone, 92);
    const currentShift = shiftIsoPreservingLocalTime(changed!.startsOn, changed!.timezone, 92);
    expect(baseShift).toBe('2027-01-31T22:30:00.000Z');
    expect(currentShift).toBe('2027-01-31T23:30:00.000Z');
    const wall = (iso: string) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Canada/Newfoundland',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(iso));
    expect(wall(baseline!.startsOn)).toBe('19:00');
    expect(wall(changed!.startsOn)).toBe('20:00');
    expect(wall(baseShift)).toBe('19:00');
    expect(wall(currentShift)).toBe('20:00');
  });

  it('keeps Dublin 17:15 local when the fixture dates move forward', () => {
    const dublin = parseDiscoveryEvent(read('events/pumpkins-dublin.json'));
    expect(dublin?.startsOn).toBe('2026-10-30T17:15:00Z');
    const shifted = shiftIsoPreservingLocalTime(dublin!.startsOn, 'Europe/Dublin', 120);
    const local = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Dublin',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(shifted));
    expect(local).toBe('17:15');
    expect(shifted).not.toBe('2026-10-30T17:15:00.000Z');
  });
});

describe('showpass fixture adapter', () => {
  const adapter = new FixtureShowpassAdapter(
    'sp_demo_valid_key',
    'fixture',
    'sp_demo_webhook_secret'
  );

  it('lists the fixture organizer and rejects an invalid key', async () => {
    const events = await adapter.listEvents();
    expect(events.map((event) => event.fixtureId).sort()).toEqual([
      'sp-evt-1530323',
      'sp-evt-1543494',
      'sp-evt-1545631',
      'sp-evt-1563243',
    ]);
    const invalid = new FixtureShowpassAdapter('sp_demo_revoked_key', 'fixture', '');
    await expect(invalid.verifyCredentials()).rejects.toBeInstanceOf(VendorAuthError);
    await expect(invalid.verifyCredentials()).rejects.toThrow('Invalid token.');
  });

  it('returns the unverified sold totals for the mardi gras fixture', async () => {
    await expect(adapter.getSoldCounts('1563243')).resolves.toEqual([
      { externalTicketTypeId: '4581612', soldCount: 40 },
      { externalTicketTypeId: '4581610', soldCount: 250 },
    ]);
    await expect(adapter.getSoldCounts('1530323')).resolves.toEqual([]);
  });

  it('verifies the documented signature and drops buyer fields', () => {
    const raw = readFileSync(path.join(fixtureRoot, 'webhooks/invoice-purchase.documented.json'));
    const payload = JSON.parse(raw.toString('utf8'));
    const secret = 'sp_demo_webhook_secret';
    const signature = showpassSignature(payload.id, secret);
    expect(signature).toBe(createHmac('sha1', secret).update(payload.id, 'utf8').digest('hex'));
    const verified = adapter.verifyWebhook({
      headers: { 'x-showpass-signature': signature },
      rawBody: raw,
      secret,
    });
    expect(verified.webhookId).toBe('09117c09-e1f8-4913-b2f5-52cc161cf5f7');
    expect(verified.deltas).toEqual([
      { externalItemId: '474708', externalTicketTypeId: '1657978', quantity: 1 },
    ]);
    const counted = countInvoice(payload);
    expect(counted && countedInvoiceHasBuyerData(counted)).toBe(false);
    const rejectedType = { ...payload, event_type: 'invoice.transfer' };
    expect(countInvoice(rejectedType)).toBeNull();
    expect(JSON.stringify(verified)).not.toContain('example@showpass.com');
    expect(JSON.stringify(verified)).not.toContain('5GHOEEHUG');
    expect(() =>
      adapter.verifyWebhook({
        headers: { 'x-showpass-signature': '00' },
        rawBody: raw,
        secret,
      })
    ).toThrow('Invalid webhook signature');
  });
});

describe('showpass adapter selection', () => {
  it('requires SHOWPASS_ADAPTER to be fixture or live', () => {
    const previous = process.env.SHOWPASS_ADAPTER;
    delete process.env.SHOWPASS_ADAPTER;
    try {
      expect(() =>
        createVendorAdapter({
          provider: 'showpass',
          apiKey: 'sp_demo_valid_key',
          venueId: 'fixture',
        })
      ).toThrow('SHOWPASS_ADAPTER must be set to fixture or live');
    } finally {
      if (previous === undefined) delete process.env.SHOWPASS_ADAPTER;
      else process.env.SHOWPASS_ADAPTER = previous;
    }
  });
});

describe('vendor credential encryption', () => {
  const key = 'ab'.repeat(32);

  it('round-trips an API key and does not repeat the ciphertext', () => {
    process.env.VENDOR_CREDENTIAL_KEY = key;
    const first = encryptVendorSecret('sp_demo_valid_key');
    const second = encryptVendorSecret('sp_demo_valid_key');
    expect(first).not.toBe(second);
    expect(first).not.toContain('sp_demo_valid_key');
    expect(decryptVendorSecret(first)).toBe('sp_demo_valid_key');
    expect(decryptVendorSecret(second)).toBe('sp_demo_valid_key');
  });
});
