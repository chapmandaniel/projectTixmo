import { createHash } from 'crypto';
import { VendorEventRecord, VendorTicketType } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalString = (value: unknown) =>
  value === undefined || value === null || typeof value === 'string';

const ticketType = (value: unknown): VendorTicketType | null => {
  if (!isRecord(value) || typeof value.id !== 'number' || !Number.isFinite(value.id)) return null;
  if (!(value.name === null || typeof value.name === 'string')) return null;
  if (!(value.price === null || typeof value.price === 'string')) return null;
  const inventory = value.inventory_left;
  if (
    inventory !== undefined &&
    inventory !== null &&
    !(typeof inventory === 'number' && Number.isFinite(inventory))
  ) {
    return null;
  }
  return {
    externalId: String(value.id),
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Ticket',
    price: typeof value.price === 'string' && value.price.trim() ? value.price : '0.00',
    inventoryLeft: typeof inventory === 'number' ? inventory : null,
  };
};

/**
 * Accepts one Showpass Discovery event object. Documented in
 * skills/build-showpass-widgets/references/public-api-to-widget.md.
 * Returns null when the object is not a usable event.
 */
export const parseDiscoveryEvent = (item: unknown): VendorEventRecord | null => {
  if (!isRecord(item) || item.type !== 'event') return null;
  if (typeof item.item_id !== 'number' || !Number.isFinite(item.item_id)) return null;
  if (typeof item.name !== 'string' || !item.name.trim()) return null;
  if (typeof item.slug !== 'string' || !item.slug.trim()) return null;
  if (typeof item.starts_on !== 'string' || !Number.isFinite(Date.parse(item.starts_on)))
    return null;
  if (typeof item.timezone !== 'string' || !item.timezone.trim()) return null;
  if (!optionalString(item.uuid) || !optionalString(item.description_without_html)) return null;
  if (!optionalString(item.ends_on) || !optionalString(item.frontend_details_url)) return null;
  if (item.ends_on && !Number.isFinite(Date.parse(item.ends_on))) return null;
  if (item.image !== undefined && item.image !== null && typeof item.image !== 'string')
    return null;
  if (
    item.image_banner !== undefined &&
    item.image_banner !== null &&
    typeof item.image_banner !== 'string'
  )
    return null;
  if (item.sub_items !== undefined && !Array.isArray(item.sub_items)) return null;
  const tickets = (Array.isArray(item.sub_items) ? item.sub_items : [])
    .map(ticketType)
    .filter((row): row is VendorTicketType => row !== null);
  if (
    !isRecord(item.venue) ||
    typeof item.venue.id !== 'number' ||
    typeof item.venue.name !== 'string'
  )
    return null;
  if (typeof item.venue.currency !== 'string') return null;
  const location = item.location;
  let parsedLocation: VendorEventRecord['location'] = null;
  if (location !== undefined && location !== null) {
    if (!isRecord(location)) return null;
    parsedLocation = {
      street: typeof location.street_name === 'string' ? location.street_name : 'Unknown',
      city: typeof location.city === 'string' ? location.city : 'Unknown',
      state: typeof location.province === 'string' ? location.province : 'Unknown',
      country: typeof location.country === 'string' ? location.country : 'Unknown',
      postalCode: typeof location.postal_code === 'string' ? location.postal_code : '00000',
    };
  }
  const purchaseUrl =
    typeof item.frontend_details_url === 'string' ? item.frontend_details_url : '';
  return {
    fixtureId: `sp-evt-${item.item_id}`,
    externalId: typeof item.uuid === 'string' && item.uuid ? item.uuid : String(item.item_id),
    externalItemId: String(item.item_id),
    name: item.name.trim(),
    slug: item.slug.trim(),
    description:
      typeof item.description_without_html === 'string' ? item.description_without_html : '',
    startsOn: item.starts_on,
    endsOn: typeof item.ends_on === 'string' ? item.ends_on : null,
    timezone: item.timezone.trim(),
    purchaseUrl,
    image: typeof item.image === 'string' ? item.image : null,
    imageBanner: typeof item.image_banner === 'string' ? item.image_banner : null,
    soldOut:
      item.sold_out === true ||
      item.inventory_sold_out === true ||
      item.public_inventory_sold_out === true,
    isRecurringParent: item.is_recurring_parent === true,
    currency: item.venue.currency,
    venueName: item.venue.name,
    venueExternalId: String(item.venue.id),
    location: parsedLocation,
    ticketTypes: tickets,
  };
};

export const eventFingerprint = (event: VendorEventRecord): string => {
  const canonical = {
    name: event.name,
    description: event.description,
    startsOn: event.startsOn,
    endsOn: event.endsOn,
    timezone: event.timezone,
    purchaseUrl: event.purchaseUrl,
    image: event.image,
    soldOut: event.soldOut,
    ticketTypes: [...event.ticketTypes]
      .sort((a, b) => a.externalId.localeCompare(b.externalId))
      .map((ticket) => ({
        id: ticket.externalId,
        name: ticket.name,
        price: ticket.price,
      })),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
};

export const slugifyVendorSlug = (slug: string): string => {
  const base = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'event';
};

export type PreviewStatus = 'new' | 'existing' | 'changed';

export const classifyVendorEvent = (
  fingerprint: string,
  linkedFingerprint?: string | null
): PreviewStatus => {
  if (!linkedFingerprint) return 'new';
  return linkedFingerprint === fingerprint ? 'existing' : 'changed';
};
