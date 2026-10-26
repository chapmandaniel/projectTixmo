// Buyer-facing times are Newfoundland civil time, never the server zone.
export const NEWFOUNDLAND_TIME_ZONE = 'America/St_Johns';

export const newfoundlandAbbreviation = (value: Date): 'NST' | 'NDT' => {
  const offset =
    new Intl.DateTimeFormat('en-CA', {
      timeZone: NEWFOUNDLAND_TIME_ZONE,
      timeZoneName: 'longOffset',
      hour: 'numeric',
    })
      .formatToParts(value)
      .find((part) => part.type === 'timeZoneName')?.value ?? '';
  const normalized = offset.replace(/\u2212/g, '-');
  if (normalized.includes('-02:30')) return 'NDT';
  if (normalized.includes('-03:30')) return 'NST';
  throw new Error('Unrecognized Newfoundland offset');
};

export const formatNewfoundlandDateTime = (value: Date): string => {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: NEWFOUNDLAND_TIME_ZONE,
  }).format(value);
  return `${formatted} ${newfoundlandAbbreviation(value)}`;
};
