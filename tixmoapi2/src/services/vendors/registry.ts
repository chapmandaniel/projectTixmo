import { FixtureShowpassAdapter } from './showpass-fixture';
import { LiveShowpassAdapter } from './showpass-live';
import { VendorTicketingAdapter } from './types';

export type AdapterRequest = {
  provider: 'showpass' | 'tixr';
  apiKey: string;
  venueId: string;
  webhookSecret?: string;
};

export const createVendorAdapter = (request: AdapterRequest): VendorTicketingAdapter => {
  if (request.provider === 'tixr') {
    throw new Error('Tixr adapter is not part of this release');
  }
  const secret = request.webhookSecret || '';
  if (process.env.SHOWPASS_ADAPTER === 'live') {
    return new LiveShowpassAdapter(request.apiKey, request.venueId, secret);
  }
  return new FixtureShowpassAdapter(request.apiKey, request.venueId, secret);
};
