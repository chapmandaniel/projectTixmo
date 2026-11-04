type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const partsOf = (date: Date, timeZone: string): ZonedParts => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  let day = Number(bag.day);
  if (hour === 24) {
    hour = 0;
    day += 1;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day,
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
};

const wallTimeToUtc = (parts: ZonedParts, timeZone: string): Date => {
  let utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const got = partsOf(new Date(utc), timeZone);
    const gotUtc = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
    const want = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    if (gotUtc === want) break;
    utc += want - gotUtc;
  }
  return new Date(utc);
};

const addCalendarDays = (parts: ZonedParts, days: number): ZonedParts => {
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second)
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
};

/** Move an instant by whole local calendar days without changing the wall clock. */
export const shiftIsoPreservingLocalTime = (
  iso: string,
  timeZone: string,
  shiftDays: number
): string => {
  if (!shiftDays) return new Date(iso).toISOString();
  const parts = partsOf(new Date(iso), timeZone);
  return wallTimeToUtc(addCalendarDays(parts, shiftDays), timeZone).toISOString();
};

export const shiftDaysToClear = (
  events: Array<{ startsOn: string; endsOn: string | null; timezone: string }>,
  now = new Date(),
  bufferDays = 90
): number => {
  let max = 0;
  for (const event of events) {
    const iso = event.endsOn || event.startsOn;
    const end = partsOf(new Date(iso), event.timezone);
    const today = partsOf(now, event.timezone);
    const endUtc = Date.UTC(end.year, end.month - 1, end.day);
    const targetUtc = Date.UTC(today.year, today.month - 1, today.day + bufferDays);
    const days = Math.ceil((targetUtc - endUtc) / 86_400_000);
    if (days > max) max = days;
  }
  return Math.max(0, max);
};
