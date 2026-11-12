/** Default v1 phrases. Whole word or phrase, case-insensitive. Longest phrase wins. */

export const TOPICS = [
  'Safety',
  'Ticketing',
  'Refunds',
  'Access/Entry',
  'Lineup',
  'Other',
] as const;

export type Topic = (typeof TOPICS)[number];

/** Tie-break order when two matches have the same length. Other is never a phrase. */
export const TOPIC_TIE_ORDER = [
  'Safety',
  'Ticketing',
  'Refunds',
  'Access/Entry',
  'Lineup',
] as const satisfies readonly Exclude<Topic, 'Other'>[];

export const DEFAULT_TOPIC_PHRASES: Record<Exclude<Topic, 'Other'>, readonly string[]> = {
  Ticketing: ['ticket', 'qr', 'transfer', 'resale', 'sold out', 'presale code'],
  Refunds: ['refund', 'chargeback', 'money back', 'cancelled'],
  'Access/Entry': ['line', 'queue', 'entry', 'wristband', 'doors', 'bag policy'],
  Lineup: ['set time', 'cancelled set', 'headliner', 'clash'],
  Safety: ['injured', 'medical', 'crush', 'unsafe', 'harass', 'lost child'],
};

export interface PhraseHit {
  topic: Exclude<Topic, 'Other'>;
  phrase: string;
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Hyphen and other punctuation are boundaries. "line" does not match "lineup". */
export const phraseMatches = (text: string, phrase: string): boolean => {
  const body = phrase.trim().split(/\s+/).map(escapeRegex).join('\\s+');
  if (!body) return false;
  const pattern = new RegExp(`(?:^|[^A-Za-z0-9])(?:${body})(?=$|[^A-Za-z0-9])`, 'i');
  return pattern.test(text);
};

export const findPhraseHits = (
  text: string,
  lists: Record<Exclude<Topic, 'Other'>, readonly string[]> = DEFAULT_TOPIC_PHRASES
): PhraseHit[] => {
  const hits: PhraseHit[] = [];
  for (const topic of TOPIC_TIE_ORDER) {
    for (const phrase of lists[topic]) {
      if (phraseMatches(text, phrase)) hits.push({ topic, phrase });
    }
  }
  return hits;
};

/** Longest phrase wins. Equal lengths use Safety, Ticketing, Refunds, Access/Entry, Lineup. */
export const winningPhrase = (hits: readonly PhraseHit[]): PhraseHit | null => {
  if (!hits.length) return null;
  const longest = Math.max(...hits.map((hit) => hit.phrase.length));
  const tied = hits.filter((hit) => hit.phrase.length === longest);
  tied.sort(
    (left, right) => TOPIC_TIE_ORDER.indexOf(left.topic) - TOPIC_TIE_ORDER.indexOf(right.topic)
  );
  return tied[0];
};

export const cloneDefaultPhrases = (): Record<Exclude<Topic, 'Other'>, string[]> => ({
  Ticketing: [...DEFAULT_TOPIC_PHRASES.Ticketing],
  Refunds: [...DEFAULT_TOPIC_PHRASES.Refunds],
  'Access/Entry': [...DEFAULT_TOPIC_PHRASES['Access/Entry']],
  Lineup: [...DEFAULT_TOPIC_PHRASES.Lineup],
  Safety: [...DEFAULT_TOPIC_PHRASES.Safety],
});
