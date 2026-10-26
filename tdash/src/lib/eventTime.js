export const DEFAULT_EVENT_TIMEZONE = 'America/St_Johns';

export const resolveEventTimeZone = (zone) => {
    const trimmed = typeof zone === 'string' ? zone.trim() : '';
    return trimmed || DEFAULT_EVENT_TIMEZONE;
};

export const validTimeZone = (zone) => {
    try { new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(); return Boolean(zone); }
    catch { return false; }
};

const fields = (value, zone) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date(value)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));

export const toEventLocalInput = (value, zone = DEFAULT_EVENT_TIMEZONE) => {
    if (!value) return '';
    if (!validTimeZone(zone) || Number.isNaN(new Date(value).getTime())) throw new Error('Invalid event time or timezone.');
    const p = fields(value, zone);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

export const fromEventLocalInput = (value, zone = DEFAULT_EVENT_TIMEZONE, previousInstant) => {
    if (!value) return null;
    if (!validTimeZone(zone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter a valid event time and IANA timezone.');
    // Preserve an unchanged instant, including either occurrence of a repeated
    // DST hour and any seconds in an existing event timestamp.
    if (previousInstant && toEventLocalInput(previousInstant, zone) === value) return new Date(previousInstant).toISOString();
    const naive = Date.parse(value + ':00Z');
    if (!Number.isFinite(naive)) throw new Error('Invalid event date.');
    const offsets = new Set();
    for (let hour = -36; hour <= 36; hour += 6) {
        const sample = naive + hour * 3600000;
        const p = fields(sample, zone);
        offsets.add(Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - sample);
    }
    const matches = [...offsets].map(offset => naive - offset).filter(instant => toEventLocalInput(instant, zone) === value);
    if (!matches.length) throw new Error(`This local time does not exist in ${zone}. Check the daylight saving change.`);
    if (matches.length > 1) throw new Error(`This local time occurs twice in ${zone}. Choose a time outside the repeated daylight saving hour.`);
    return new Date(matches[0]).toISOString();
};

export const formatEventDate = (value, zone = DEFAULT_EVENT_TIMEZONE, options = {}) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return 'Date to be announced';
    if (!validTimeZone(zone)) return 'Event timezone unavailable';
    return new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'short', month: 'short',
        day: 'numeric', hour: 'numeric', minute: '2-digit', ...options }).format(new Date(value));
};
