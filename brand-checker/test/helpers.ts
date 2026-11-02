import type { HttpClient, HttpResponse } from '../src/types.js';
import type { OrganizationTarget } from '../src/types.js';

export const demoOrg = (): OrganizationTarget => ({
  organizationId: '11111111-1111-4111-8111-111111111111',
  names: ['Harbour Fest'],
  domains: ['harbourfest.example'],
  accounts: [
    {
      platform: 'X',
      platformAccountId: '1000000001',
      handle: 'harbourfest',
      profileUrl: 'https://x.com/harbourfest',
      displayName: 'Harbour Fest',
    },
  ],
});

export const trackingClient = (
  handler: (url: string) => HttpResponse
): { client: HttpClient; urls: string[] } => {
  const urls: string[] = [];
  return {
    urls,
    client: {
      async request(url) {
        urls.push(url);
        return handler(url);
      },
    },
  };
};

export const page = (url: string, status: number, body: string, finalUrl = url): HttpResponse => ({
  status,
  url: finalUrl,
  body,
});
