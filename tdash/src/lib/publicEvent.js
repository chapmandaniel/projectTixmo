import { DEFAULT_EVENT_TIMEZONE, validTimeZone } from './eventTime';

export {
    HST_INCLUDED_NOTE,
    PRICE_INCLUDES_NOTE,
    formatEventMoney,
    hstAmountLine,
    hstRegistrationLine,
    includedHstAmount,
} from './money';

export const eventTimeZone = (event) =>
    validTimeZone(event?.timezone) ? event.timezone : DEFAULT_EVENT_TIMEZONE;

export const getEventSaleState = (event, now = Date.now()) => {
    if (event.status === 'SOLD_OUT')
        return { label: 'Sold out', available: false };
    if (!['ON_SALE', 'PUBLISHED'].includes(event.status))
        return { label: 'Tickets unavailable', available: false };
    if (event.startDatetime && now >= Date.parse(event.startDatetime))
        return { label: 'Sales ended', available: false };
    if (event.salesEnd && now >= Date.parse(event.salesEnd))
        return { label: 'Sales ended', available: false };
    if (event.salesPaused)
        return { label: 'Sales paused', available: false };
    if (event.salesStart && now < Date.parse(event.salesStart))
        return { label: 'On sale soon', available: false };
    return { label: 'On sale now', available: true };
};

// The public payload is advisory. The order API rechecks inventory and pricing
// under a transaction lock; a selection on this page never reserves tickets.
export const getPublicTicketOffer = (ticket, now = Date.now()) => {
    const tiers = [...(ticket.tiers || [])].sort(
        (a, b) =>
            (a.sortOrder || 0) - (b.sortOrder || 0) ||
            String(a.id).localeCompare(String(b.id)),
    );
    const tier = tiers.find(
        (item) =>
            item.isActive !== false &&
            (!item.startsAt || now >= Date.parse(item.startsAt)) &&
            (!item.endsAt || now < Date.parse(item.endsAt)) &&
            (item.quantityLimit == null ||
                Number(item.quantitySold || 0) +
                    Number(item.quantityHeld || 0) <
                    Number(item.quantityLimit)),
    );
    const price = Number(tier?.price ?? ticket.price);
    const inventory = Math.max(0, Number(ticket.quantityAvailable) || 0);
    const tierRemaining =
        tier?.quantityLimit == null
            ? inventory
            : Math.max(
                  0,
                  Number(tier.quantityLimit) -
                      Number(tier.quantitySold || 0) -
                      Number(tier.quantityHeld || 0),
              );
    const max = Math.max(
        0,
        Math.floor(
            Math.min(
                inventory,
                Number(ticket.maxPerOrder ?? 10),
                tierRemaining,
            ),
        ),
    );
    let label = 'Available';
    if (ticket.status && ticket.status !== 'ACTIVE')
        label = ticket.status === 'SOLD_OUT' ? 'Sold out' : 'Unavailable';
    else if (
        ticket.tierInventoryStatus &&
        ticket.tierInventoryStatus !== 'READY'
    )
        label = 'Temporarily unavailable';
    else if (ticket.salesStart && now < Date.parse(ticket.salesStart))
        label = 'On sale soon';
    else if (ticket.salesEnd && now >= Date.parse(ticket.salesEnd))
        label = 'Sales ended';
    else if (!inventory) label = 'Sold out';
    else if (
        ((ticket.hasConfiguredTiers || tiers.length) && !tier) ||
        !Number.isFinite(price) ||
        price < 0 ||
        !max
    )
        label = 'Currently unavailable';
    return {
        price: Number.isFinite(price) ? price : 0,
        max: label === 'Available' ? max : 0,
        label,
        tier,
    };
};

export const initialTicketQuantities = (
    tickets = [],
    requested = '',
    now = Date.now(),
) => {
    const entries = new Map(
        String(requested)
            .split(',')
            .slice(0, 100)
            .map((entry) => entry.split(':')),
    );
    return Object.fromEntries(
        tickets.map((ticket) => {
            const value = Number(entries.get(ticket.id));
            const max = getPublicTicketOffer(ticket, now).max;
            return [
                ticket.id,
                Number.isSafeInteger(value) && value > 0
                    ? Math.min(max, value)
                    : 0,
            ];
        }),
    );
};

export const checkoutSelection = (quantities) =>
    Object.entries(quantities)
        .filter(
            ([, quantity]) => Number.isSafeInteger(quantity) && quantity > 0,
        )
        .map(([id, quantity]) => `${id}:${quantity}`)
        .join(',');

export const eventAddress = (venue) => {
    const address = venue?.address;
    if (typeof address === 'string') return address;
    if (!address || typeof address !== 'object') return '';
    return [
        address.line1 || address.street || address.address1,
        address.line2,
        address.city,
        address.province || address.state,
        address.postalCode,
        address.country,
    ]
        .filter((value) => typeof value === 'string' && value.trim())
        .join(', ');
};

export const eventArtwork = (event) => {
    const candidate = event.images?.main;
    if (typeof candidate !== 'string') return '';
    // Keep links and image sources to web URLs or same-origin absolute paths.
    if (candidate.startsWith('/') && !candidate.startsWith('//'))
        return candidate;
    try {
        return ['https:', 'http:'].includes(new URL(candidate).protocol)
            ? candidate
            : '';
    } catch {
        return '';
    }
};
