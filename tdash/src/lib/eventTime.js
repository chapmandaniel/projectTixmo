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

// Used when Intl returns a GMT offset instead of NST/NDT, AST/ADT, and the other Canadian abbreviations.
const CANADIAN_ZONE_ABBREVIATIONS = Object.fromEntries([
    [['America/St_Johns', 'Canada/Newfoundland'], { '-03:30': 'NST', '-02:30': 'NDT' }],
    [['America/Halifax', 'America/Glace_Bay', 'America/Moncton', 'America/Goose_Bay', 'Canada/Atlantic'], { '-04:00': 'AST', '-03:00': 'ADT' }],
    [['America/Blanc-Sablon'], { '-04:00': 'AST' }],
    [['America/Toronto', 'America/Iqaluit', 'America/Montreal', 'America/Nipigon', 'America/Thunder_Bay', 'America/Pangnirtung', 'Canada/Eastern'], { '-05:00': 'EST', '-04:00': 'EDT' }],
    [['America/Atikokan', 'America/Coral_Harbour'], { '-05:00': 'EST' }],
    [['America/Winnipeg', 'America/Rainy_River', 'America/Rankin_Inlet', 'America/Resolute', 'Canada/Central'], { '-06:00': 'CST', '-05:00': 'CDT' }],
    [['America/Regina', 'America/Swift_Current', 'Canada/Saskatchewan', 'Canada/East-Saskatchewan'], { '-06:00': 'CST' }],
    [['America/Edmonton', 'America/Cambridge_Bay', 'America/Inuvik', 'America/Yellowknife', 'Canada/Mountain'], { '-07:00': 'MST', '-06:00': 'MDT' }],
    [['America/Creston', 'America/Dawson_Creek', 'America/Fort_Nelson', 'America/Whitehorse', 'America/Dawson', 'Canada/Yukon'], { '-07:00': 'MST' }],
    [['America/Vancouver', 'Canada/Pacific'], { '-08:00': 'PST', '-07:00': 'PDT' }],
].flatMap(([zones, labels]) => zones.map((zone) => [zone, labels])));

const normalizedOffset = (value) => {
    const text = String(value || '').replace(/\u2212/g, '-').replace(/\s+/g, '');
    if (/^(?:GMT|UTC)$/i.test(text)) return '+00:00';
    const match = text.match(/([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (!match) return '';
    return `${match[1]}${match[2].padStart(2, '0')}:${match[3] || '00'}`;
};

const readableOffset = (offset) => {
    const match = String(offset || '').match(/^([+-])(\d{2}):(\d{2})$/);
    if (!match) return '';
    if (match[2] === '00' && match[3] === '00') return 'UTC';
    const minutes = match[3] === '00' ? '' : `:${match[3]}`;
    return `UTC${match[1]}${Number(match[2])}${minutes}`;
};

const zoneNamePart = (date, zone, timeZoneName) => {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: zone, hour: 'numeric', timeZoneName,
        }).formatToParts(date).find((item) => item.type === 'timeZoneName')?.value || '';
    } catch {
        return '';
    }
};

const gmtStyleName = (value) => /^(?:GMT|UTC)(?:\s|[+-]|$)/i.test(String(value || '').replace(/\u2212/g, '-').trim());

// Abbreviation for the event zone at this instant, so daylight saving is date-specific.
export const eventZoneAbbreviation = (value, zone = DEFAULT_EVENT_TIMEZONE) => {
    const resolved = resolveEventTimeZone(zone);
    if (!value || Number.isNaN(new Date(value).getTime()) || !validTimeZone(resolved)) return '';
    const date = new Date(value);
    const short = zoneNamePart(date, resolved, 'short');
    if (short && !gmtStyleName(short)) return short;
    const offset = normalizedOffset(zoneNamePart(date, resolved, 'longOffset') || short);
    return CANADIAN_ZONE_ABBREVIATIONS[resolved]?.[offset] || readableOffset(offset) || short;
};

export const formatEventDate = (value, zone = DEFAULT_EVENT_TIMEZONE, options = {}) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return 'Date to be announced';
    if (!validTimeZone(zone)) return 'Event timezone unavailable';
    const { timeZoneName, ...rest } = options;
    const formatted = new Intl.DateTimeFormat('en-CA', {
        timeZone: zone, weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', ...rest,
    }).format(new Date(value));
    if (!timeZoneName) return formatted;
    const abbreviation = eventZoneAbbreviation(value, zone);
    return abbreviation ? `${formatted} ${abbreviation}` : formatted;
};
