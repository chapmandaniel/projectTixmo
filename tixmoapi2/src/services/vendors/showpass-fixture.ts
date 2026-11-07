import { readFileSync } from 'fs';
import path from 'path';
import { ApiError } from '../../utils/ApiError';
import { parseDiscoveryEvent } from './discovery';
import { shiftIsoPreservingLocalTime } from './fixture-clock';
import { resolveFixtureControl } from './fixture-runtime';
import { countInvoice, readSignedIdentity } from './invoice-counts';
import { showpassSignature, showpassSignaturesMatch } from './showpass-signature';
import {
  VendorAuthError,
  VendorEventRecord,
  VendorSoldCount,
  VendorTicketingAdapter,
  VerifiedVendorWebhook,
} from './types';

type Catalog = {
  fixtureVenueId: string;
  revisions: Record<string, string[]>;
};

const root = () => path.resolve(__dirname, '../../../fixtures/showpass');

const readJson = (relative: string): unknown =>
  JSON.parse(readFileSync(path.join(root(), relative), 'utf8'));

const headerValue = (headers: Record<string, string | string[] | undefined>, name: string) => {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
};

export class FixtureShowpassAdapter implements VendorTicketingAdapter {
  readonly provider = 'showpass' as const;

  constructor(
    private readonly apiKey: string,
    private readonly venueId: string,
    private readonly webhookSecret: string
  ) {}

  private catalog(): Catalog {
    return readJson('catalog.json') as Catalog;
  }

  private shift(event: VendorEventRecord, shiftDays: number): VendorEventRecord {
    if (!shiftDays) return event;
    return {
      ...event,
      startsOn: shiftIsoPreservingLocalTime(event.startsOn, event.timezone, shiftDays),
      endsOn: event.endsOn
        ? shiftIsoPreservingLocalTime(event.endsOn, event.timezone, shiftDays)
        : null,
    };
  }

  private async events(): Promise<VendorEventRecord[]> {
    const catalog = this.catalog();
    const control = await resolveFixtureControl();
    const files = catalog.revisions[control.revision];
    if (!files) throw new ApiError(500, `Unknown Showpass fixture revision ${control.revision}`);
    const parsed = files
      .map((file) => parseDiscoveryEvent(readJson(file)))
      .filter((event): event is VendorEventRecord => event !== null)
      .map((event) => this.shift(event, control.shiftDays));
    if (this.venueId === catalog.fixtureVenueId) return parsed;
    return parsed.filter((event) => event.venueExternalId === this.venueId);
  }

  async verifyCredentials(): Promise<void> {
    const control = await resolveFixtureControl();
    const auth = readJson('auth.json') as {
      body?: { detail?: string };
      demoKeys?: Record<string, string>;
    };
    const detail = auth.body?.detail || 'Invalid token.';
    const state = auth.demoKeys?.[this.apiKey];
    if (control.revokedKeys.includes(this.apiKey) || state === 'revoked' || state !== 'active') {
      throw new VendorAuthError(detail);
    }
  }

  async listEvents(): Promise<VendorEventRecord[]> {
    await this.verifyCredentials();
    return this.events();
  }

  async getEvent(externalItemId: string): Promise<VendorEventRecord> {
    await this.verifyCredentials();
    const event = (await this.events()).find((item) => item.externalItemId === externalItemId);
    if (!event) throw new ApiError(404, 'Showpass event was not found in the fixture catalog');
    return event;
  }

  async getSoldCounts(externalItemId: string): Promise<VendorSoldCount[]> {
    await this.verifyCredentials();
    const file = readJson('sold-counts.unverified.json') as {
      events?: Array<{
        item_id?: number;
        ticket_types?: Array<{ id?: number; sold_count?: number }>;
      }>;
    };
    const match = (file.events || []).find((event) => String(event.item_id) === externalItemId);
    if (!match) return [];
    return (match.ticket_types || []).flatMap((ticket) => {
      if (typeof ticket.id !== 'number' || typeof ticket.sold_count !== 'number') return [];
      return [{ externalTicketTypeId: String(ticket.id), soldCount: ticket.sold_count }];
    });
  }

  verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: Buffer;
    secret: string;
  }): VerifiedVendorWebhook {
    const secret = input.secret || this.webhookSecret;
    let payload: unknown;
    try {
      payload = JSON.parse(input.rawBody.toString('utf8'));
    } catch {
      throw new ApiError(400, 'Showpass webhook body is not JSON');
    }
    const identity = readSignedIdentity(payload);
    if (!identity) throw new ApiError(400, 'Showpass webhook payload is not a recognized invoice');
    const provided = headerValue(input.headers, 'x-showpass-signature');
    const expected = secret ? showpassSignature(identity.invoiceId, secret) : '';
    if (!secret || !showpassSignaturesMatch(expected, provided)) {
      throw new ApiError(401, 'Invalid webhook signature');
    }
    const counted = countInvoice(payload);
    if (!counted) throw new ApiError(400, 'Showpass webhook payload is not a recognized invoice');
    return { webhookId: counted.webhookId, eventType: counted.eventType, deltas: counted.deltas };
  }
}
