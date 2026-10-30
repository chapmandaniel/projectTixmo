import {
  VendorEventRecord,
  VendorSoldCount,
  VendorTicketingAdapter,
  VerifiedVendorWebhook,
} from './types';
import { FixtureShowpassAdapter } from './showpass-fixture';

/**
 * Placeholder for the live Showpass client. v1 never calls the network.
 * When OC-1 and OC-2 are cleared, implement list/get against
 * https://www.showpass.com/api/public/discovery/ and authenticate private
 * calls with `Authorization: Token <key>` as documented. Keep sold totals
 * and buyer-field stripping behind this class so the unverified count shape
 * can be replaced without touching import or billing code (there is no
 * billing code).
 */
export class LiveShowpassAdapter implements VendorTicketingAdapter {
  readonly provider = 'showpass' as const;

  constructor(
    private readonly apiKey: string,
    private readonly venueId: string,
    private readonly webhookSecret: string
  ) {}

  private disabled(): never {
    throw new Error(
      'Live Showpass adapter is not enabled. Leave SHOWPASS_ADAPTER unset or set it to fixture.'
    );
  }

  verifyCredentials(): Promise<void> {
    return this.disabled();
  }

  listEvents(): Promise<VendorEventRecord[]> {
    return this.disabled();
  }

  getEvent(): Promise<VendorEventRecord> {
    return this.disabled();
  }

  getSoldCounts(): Promise<VendorSoldCount[]> {
    return this.disabled();
  }

  verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: Buffer;
    secret: string;
  }): VerifiedVendorWebhook {
    // Signature verification is documented and does not call Showpass.
    return new FixtureShowpassAdapter(this.apiKey, this.venueId, this.webhookSecret).verifyWebhook(
      input
    );
  }
}
