export type VendorProviderName = 'showpass' | 'tixr';

export class VendorAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorAuthError';
  }
}

export type VendorTicketType = {
  externalId: string;
  name: string;
  price: string;
  inventoryLeft: number | null;
};

export type VendorEventRecord = {
  fixtureId: string;
  externalId: string;
  externalItemId: string;
  name: string;
  slug: string;
  description: string;
  startsOn: string;
  endsOn: string | null;
  timezone: string;
  purchaseUrl: string;
  image: string | null;
  imageBanner: string | null;
  soldOut: boolean;
  isRecurringParent: boolean;
  currency: string;
  venueName: string;
  venueExternalId: string;
  location: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  } | null;
  ticketTypes: VendorTicketType[];
};

export type VendorSoldCount = {
  externalTicketTypeId: string;
  soldCount: number;
};

export type VendorCountDelta = {
  externalItemId: string;
  externalTicketTypeId: string;
  quantity: number;
};

export type VerifiedVendorWebhook = {
  webhookId: string;
  eventType: string;
  deltas: VendorCountDelta[];
};

/**
 * Ticketing vendor boundary. Showpass v1 is fixture-backed. A live Showpass
 * client and a later Tixr adapter implement this same surface.
 */
export interface VendorTicketingAdapter {
  readonly provider: VendorProviderName;
  verifyCredentials(): Promise<void>;
  listEvents(): Promise<VendorEventRecord[]>;
  getEvent(externalItemId: string): Promise<VendorEventRecord>;
  getSoldCounts(externalItemId: string): Promise<VendorSoldCount[]>;
  verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: Buffer;
    secret: string;
  }): VerifiedVendorWebhook;
}
