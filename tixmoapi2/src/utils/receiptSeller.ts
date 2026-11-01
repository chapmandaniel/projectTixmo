// Platform legal name printed on buyer receipts. A configured TIXMO_SELLER_NAME
// overrides it only when that value is a plain legal name. The commented
// example that named Quincy Enterprises (and any "as ticketing agent for"
// sentence) is one promoter pasted onto every event, so it is not used.
export const DEFAULT_PLATFORM_SELLER = 'Tixmo Ltd.';

const LEGACY_GLOBAL_ORGANIZER =
  /as ticketing agent for|Quincy Enterprises|Mighty Quinton Concerts/i;

export function receiptSellerName(input: {
  configuredSellerName?: string | null;
  organizationName?: string | null;
}): string {
  const configured = input.configuredSellerName?.trim() || '';
  const platform =
    configured && !LEGACY_GLOBAL_ORGANIZER.test(configured) ? configured : DEFAULT_PLATFORM_SELLER;
  const organizer = input.organizationName?.trim() || '';
  if (!organizer || organizer.toLowerCase() === platform.toLowerCase()) return platform;
  return `${platform}, as ticketing agent for ${organizer}`;
}
