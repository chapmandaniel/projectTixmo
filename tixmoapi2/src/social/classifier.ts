import { DEFAULT_TOPIC_PHRASES, findPhraseHits, winningPhrase, type Topic } from './keywords';

export const SENTIMENT_LABELS = ['positive', 'negative', 'neutral', 'urgent', ''] as const;

export type SentimentLabel = (typeof SENTIMENT_LABELS)[number];

export interface CommentClassification {
  commentId: string;
  /** Empty string means no sentiment label. That is valid and stored. */
  label: SentimentLabel;
  topic: Topic;
  confidence: number;
  matchedTerms: string[];
  isQuestion: boolean;
  hasNegation: boolean;
  isComplaint: boolean;
  classifierId: string;
  modelVersion: string;
}

export interface CommentClassifier {
  readonly id: string;
  readonly version: string;
  classify(input: { id: string; text: string }): CommentClassification;
}

const QUESTION_START =
  /^(?:how|what|when|where|why|who|can|could|do|does|did|is|are|will|would|should)\b/i;

const NEGATION =
  /(?:^|[^A-Za-z0-9])(?:never got|still waiting|never|cannot|can't|cant|won't|wont|don't|dont|didn't|didnt|haven't|havent|hasn't|hasnt|isn't|isnt|\bnot\b|\bno\b)(?=$|[^A-Za-z0-9])/i;

const COMPLAINT =
  /(?:^|[^A-Za-z0-9])(?:complaints?|unacceptable|ridiculous|angry|upset|disappointed|ignored)(?=$|[^A-Za-z0-9])/i;

const URGENT =
  /(?:^|[^A-Za-z0-9])(?:urgent|emergency|asap|immediately|right now)(?=$|[^A-Za-z0-9])/i;
const NEGATIVE =
  /(?:^|[^A-Za-z0-9])(?:hate|terrible|awful|worst|bad|angry|upset|disappointed|ridiculous|useless)(?=$|[^A-Za-z0-9])/i;
const POSITIVE =
  /(?:^|[^A-Za-z0-9])(?:love|great|amazing|awesome|thanks|thank you|excited|can't wait|cant wait|wonderful)(?=$|[^A-Za-z0-9])/i;

const labelSet = new Set<string>(SENTIMENT_LABELS);
const topicSet = new Set<string>([
  'Safety',
  'Ticketing',
  'Refunds',
  'Access/Entry',
  'Lineup',
  'Other',
]);

export const isSentimentLabel = (value: unknown): value is SentimentLabel =>
  typeof value === 'string' && labelSet.has(value);

export const isTopic = (value: unknown): value is Topic =>
  typeof value === 'string' && topicSet.has(value);

/**
 * Unknown model output is dropped. An empty label is kept.
 * A rejected classification cannot open an issue by itself.
 */
export const normalizeClassification = (
  raw: Partial<CommentClassification> & { commentId: string }
): CommentClassification => {
  const labelOk = isSentimentLabel(raw.label);
  const topicOk = isTopic(raw.topic);
  const confidenceOk =
    typeof raw.confidence === 'number' &&
    Number.isFinite(raw.confidence) &&
    raw.confidence >= 0 &&
    raw.confidence <= 1;

  if (!topicOk) {
    return {
      commentId: raw.commentId,
      label: '',
      topic: 'Other',
      confidence: 0,
      matchedTerms: [],
      isQuestion: false,
      hasNegation: false,
      isComplaint: false,
      classifierId: raw.classifierId || 'rejected',
      modelVersion: raw.modelVersion || 'rejected',
    };
  }

  return {
    commentId: raw.commentId,
    label: labelOk ? raw.label! : '',
    topic: raw.topic as Topic,
    confidence: confidenceOk ? raw.confidence! : 0,
    matchedTerms: Array.isArray(raw.matchedTerms)
      ? raw.matchedTerms.filter((term): term is string => typeof term === 'string')
      : [],
    isQuestion: raw.isQuestion === true,
    hasNegation: raw.hasNegation === true,
    isComplaint: raw.isComplaint === true,
    classifierId: raw.classifierId || 'rule-keyword',
    modelVersion: raw.modelVersion || 'social-v1',
  };
};

const sentimentLabel = (text: string): SentimentLabel => {
  const withoutPositiveWait = text.replace(/\bcan'?t wait\b/gi, ' ');
  if (URGENT.test(withoutPositiveWait)) return 'urgent';
  const negative = NEGATIVE.test(withoutPositiveWait);
  const positive = POSITIVE.test(text);
  if (negative) return 'negative';
  if (positive) return 'positive';
  return '';
};

const hasNegation = (text: string): boolean => {
  const stripped = text.replace(/\bcan'?t wait\b/gi, ' ');
  return NEGATION.test(stripped);
};

export const createRuleKeywordClassifier = (): CommentClassifier => ({
  id: 'rule-keyword',
  version: 'social-v1',
  classify(input) {
    const text = input.text || '';
    const hits = findPhraseHits(text, DEFAULT_TOPIC_PHRASES);
    const winner = winningPhrase(hits);
    const question = text.includes('?') || QUESTION_START.test(text.trim());
    const negation = hasNegation(text);
    const complaint = COMPLAINT.test(text) || negation;
    const topic: Topic = winner ? winner.topic : 'Other';
    const matchedTerms = winner
      ? hits.filter((hit) => hit.topic === winner.topic).map((hit) => hit.phrase)
      : [];
    const uniqueTerms = [...new Set(matchedTerms)];
    let confidence = 0;
    if (winner) confidence = uniqueTerms.length > 1 || winner.phrase.includes(' ') ? 0.9 : 0.75;
    else if (question) confidence = 0.45;

    return {
      commentId: input.id,
      label: sentimentLabel(text),
      topic,
      confidence,
      matchedTerms: uniqueTerms,
      isQuestion: question,
      hasNegation: negation,
      isComplaint: complaint,
      classifierId: 'rule-keyword',
      modelVersion: 'social-v1',
    };
  },
});
