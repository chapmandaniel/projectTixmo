import { fromEventLocalInput, resolveEventTimeZone, toEventLocalInput } from './eventTime';

export const ticketSalesWindowInput = (value, zone) =>
    value ? toEventLocalInput(value, resolveEventTimeZone(zone)) : '';

// Empty fields stay omitted. An unchanged wall-clock value keeps the stored instant,
// including seconds, instead of re-parsing it in the browser's timezone.
export const ticketSalesWindowIso = (value, zone, previousInstant) => {
    if (!value) return undefined;
    return fromEventLocalInput(value, resolveEventTimeZone(zone), previousInstant);
};
