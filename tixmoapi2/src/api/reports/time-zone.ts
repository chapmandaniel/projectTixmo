const ZONE_NAME = /^[A-Za-z0-9_+-]{1,64}(?:\/[A-Za-z0-9_+-]{1,64}){0,2}$/;

export function isIanaTimeZone(zone: string): boolean {
  if (!ZONE_NAME.test(zone)) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function firstValidZone(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const zone = typeof candidate === 'string' ? candidate.trim() : '';
    if (zone && isIanaTimeZone(zone)) return zone;
  }
  return 'UTC';
}

export function organizationTimeZone(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const value = (settings as Record<string, unknown>).timezone;
  if (typeof value !== 'string') return null;
  const zone = value.trim();
  return isIanaTimeZone(zone) ? zone : null;
}

// One shared zone can label an org-wide report. Mixed venue zones cannot.
export function sharedTimeZone(zones: Array<string | null | undefined>): string | null {
  const valid = new Set<string>();
  for (const zone of zones) {
    const trimmed = typeof zone === 'string' ? zone.trim() : '';
    if (trimmed && isIanaTimeZone(trimmed)) valid.add(trimmed);
  }
  if (valid.size === 1) return [...valid][0];
  return null;
}

// Event capacity is the cap the organizer set. When that field is unset,
// effective capacity is the sum of ticket-type quantities.
export function effectiveEventCapacity(
  eventCapacity: number | null | undefined,
  ticketQuantities: Array<number | null | undefined>
): number {
  if (typeof eventCapacity === 'number' && Number.isInteger(eventCapacity) && eventCapacity > 0) {
    return eventCapacity;
  }
  return ticketQuantities.reduce<number>((sum, quantity) => {
    if (typeof quantity === 'number' && Number.isInteger(quantity) && quantity > 0) {
      return sum + quantity;
    }
    return sum;
  }, 0);
}

const offsetMinutes = (zone: string, instant: Date): number => {
  const name =
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'longOffset',
      hour: '2-digit',
    })
      .formatToParts(instant)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const normalized = name
    .replace(/^GMT/i, '')
    .replace(/\u2212/g, '-')
    .trim();
  if (!normalized || normalized.toUpperCase() === 'UTC') return 0;
  const match = /^([+-])(\d{1,2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
};

const formatOffset = (minutes: number): string => {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const mins = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${mins}`;
};

// localStamp is a civil hour in `zone` (YYYY-MM-DDTHH:00:00.000), not a UTC instant.
export function zoneDesignator(zone: string, localStamp: string): string {
  if (zone === 'UTC' || zone === 'Etc/UTC' || zone === 'Etc/GMT') return 'Z';
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(localStamp);
  if (!match || !isIanaTimeZone(zone)) return 'Z';
  const [, year, month, day, hour, minute, second] = match;
  const asUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  let utc = asUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const next = asUtc - offsetMinutes(zone, new Date(utc)) * 60_000;
    if (next === utc) break;
    utc = next;
  }
  return formatOffset(offsetMinutes(zone, new Date(utc)));
}

export function withZoneDesignator(localStamp: string, zone: string): string {
  return `${localStamp}${zoneDesignator(zone, localStamp)}`;
}
