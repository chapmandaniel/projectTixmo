/**
 * Labs demo clock. Social mock dates are authored against a fixed snapshot
 * ending 2026-11-10 and shifted so the window always ends today in
 * America/St_Johns. Nothing here is read from a network or customer store.
 */

export const REPORT_TIMEZONE = 'America/St_Johns';
export const BASE_RANGE_END = '2026-11-10';

const partValue = (parts, type) => parts.find((part) => part.type === type)?.value;

export const isoDateInZone = (date = new Date(), timeZone = REPORT_TIMEZONE) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    return `${partValue(parts, 'year')}-${partValue(parts, 'month')}-${partValue(parts, 'day')}`;
};

export const addDaysIso = (iso, days) => {
    const cursor = new Date(`${iso}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + days);
    return cursor.toISOString().slice(0, 10);
};

export const diffDaysIso = (from, to) => {
    const start = new Date(`${from}T12:00:00Z`);
    const end = new Date(`${to}T12:00:00Z`);
    return Math.round((end.getTime() - start.getTime()) / 86400000);
};

export const RANGE_END = isoDateInZone();
export const SHIFT_DAYS = diffDaysIso(BASE_RANGE_END, RANGE_END);

export const shiftDemoIso = (value) => {
    if (value == null || value === '') return value;
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})(.*)$/);
    if (!match) return value;
    return `${addDaysIso(match[1], SHIFT_DAYS)}${match[2]}`;
};

export const nowInReportZoneIso = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: REPORT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        timeZoneName: 'longOffset',
    }).formatToParts(date);
    const offsetRaw = (partValue(parts, 'timeZoneName') || 'GMT-03:30').replace(/^(GMT|UTC)/, '');
    const offset = /^[+-]\d{2}:\d{2}$/.test(offsetRaw) ? offsetRaw : '-03:30';
    return `${partValue(parts, 'year')}-${partValue(parts, 'month')}-${partValue(parts, 'day')}T${partValue(parts, 'hour')}:${partValue(parts, 'minute')}:${partValue(parts, 'second')}${offset}`;
};

export const LAST_REFRESH_AT = nowInReportZoneIso();
export const SNAPSHOT_NOW = LAST_REFRESH_AT;
export const YESTERDAY = addDaysIso(RANGE_END, -1);
