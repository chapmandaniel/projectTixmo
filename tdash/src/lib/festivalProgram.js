import {
    eventTimeZone,
    getEventSaleState,
    getPublicTicketOffer,
} from './publicEvent';

const publicStatuses = new Set(['PUBLISHED', 'ON_SALE', 'SOLD_OUT']);
const eventOrder = (event) =>
    Number.isFinite(Date.parse(event.startDatetime))
        ? Date.parse(event.startDatetime)
        : Infinity;

export const festivalDayKey = (value, timeZone) => {
    if (!value || !Number.isFinite(Date.parse(value))) return 'tba';
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
            .formatToParts(new Date(value))
            .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
};

export const festivalEvents = (festival) =>
    (festival.events || [])
        .filter((event) => publicStatuses.has(event.status) && !event.deletedAt)
        .sort(
            (a, b) =>
                eventOrder(a) - eventOrder(b) || a.name.localeCompare(b.name),
        );

export const festivalDays = (festival) => {
    const timeZone = eventTimeZone(festival);
    const days = new Map();
    for (const event of festivalEvents(festival)) {
        const key = festivalDayKey(event.startDatetime, timeZone);
        if (!days.has(key))
            days.set(key, {
                key,
                shortLabel:
                    key === 'tba'
                        ? 'Date TBA'
                        : new Intl.DateTimeFormat(undefined, {
                              timeZone,
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                          }).format(new Date(event.startDatetime)),
                label:
                    key === 'tba'
                        ? 'Dates to be announced'
                        : new Intl.DateTimeFormat(undefined, {
                              timeZone,
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                          }).format(new Date(event.startDatetime)),
                events: [],
            });
        days.get(key).events.push(event);
    }
    return [...days.values()];
};

export const festivalPasses = (festival) =>
    festival.passesEnabled === true
        ? (festival.passes || []).filter(
              (pass) => pass.status === 'ACTIVE' || pass.status === 'SOLD_OUT',
          )
        : [];

export const passCoveredEvents = (festival, pass) => {
    const includedIds = new Set(pass?.eventIds || []);
    return festivalEvents(festival).filter((event) =>
        includedIds.has(event.id),
    );
};

export const festivalEventPrice = (event, now = Date.now()) => {
    if (!getEventSaleState(event, now).available) return null;
    const prices = (event.ticketTypes || [])
        .map((ticket) => getPublicTicketOffer(ticket, now))
        .filter((offer) => offer.max > 0)
        .map((offer) => offer.price);
    return prices.length ? Math.min(...prices) : null;
};
