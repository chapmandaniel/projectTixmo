import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { createRuleKeywordClassifier, normalizeClassification } from '../../src/social/classifier';
import { DEFAULT_TOPIC_PHRASES } from '../../src/social/keywords';

const classifier = createRuleKeywordClassifier();

const classify = (text: string, id = 'c1') => classifier.classify({ id, text });

describe('rule keyword classifier', () => {
  it('uses the default phrase table exactly', () => {
    expect(DEFAULT_TOPIC_PHRASES).toEqual({
      Ticketing: ['ticket', 'qr', 'transfer', 'resale', 'sold out', 'presale code'],
      Refunds: ['refund', 'chargeback', 'money back', 'cancelled'],
      'Access/Entry': ['line', 'queue', 'entry', 'wristband', 'doors', 'bag policy'],
      Lineup: ['set time', 'cancelled set', 'headliner', 'clash'],
      Safety: ['injured', 'medical', 'crush', 'unsafe', 'harass', 'lost child'],
    });
  });

  it('matches whole words and phrases, including hyphen boundaries', () => {
    expect(classify('The QR code failed').topic).toBe('Ticketing');
    expect(classify('see the qr-code please').topic).toBe('Ticketing');
    expect(classify('the lineup is great').topic).toBe('Other');
    expect(classify('the line is not moving').topic).toBe('Access/Entry');
    expect(classify('SOLD OUT already').matchedTerms).toContain('sold out');
    expect(classify('cancelled set tonight').topic).toBe('Lineup');
    expect(classify('the show was cancelled').topic).toBe('Refunds');
  });

  it('breaks length ties by Safety, Ticketing, Refunds, Access/Entry, Lineup', () => {
    expect(classify('unsafe ticket').topic).toBe('Safety');
    expect(classify('ticket refund').topic).toBe('Ticketing');
  });

  it('allows an empty sentiment label and still returns topic and confidence', () => {
    const plain = classify('hello there');
    expect(plain.label).toBe('');
    expect(plain.topic).toBe('Other');
    expect(plain.confidence).toBe(0);
    const urgent = classify('this is urgent');
    expect(urgent.label).toBe('urgent');
    const negative = classify('this is terrible');
    expect(negative.label).toBe('negative');
    const positive = classify("can't wait for this");
    expect(positive.label).toBe('positive');
    expect(positive.hasNegation).toBe(false);
  });

  it('marks questions, negations, and complaints without using them as the label', () => {
    const question = classify('how do I transfer this?');
    expect(question.topic).toBe('Ticketing');
    expect(question.isQuestion).toBe(true);
    const negation = classify('I never got a refund');
    expect(negation.topic).toBe('Refunds');
    expect(negation.hasNegation).toBe(true);
    expect(negation.isComplaint).toBe(true);
  });

  it('drops unknown labels and topics so they cannot open an issue', () => {
    const rejected = normalizeClassification({
      commentId: 'c1',
      label: 'happy' as 'positive',
      topic: 'Scam' as 'Other',
      confidence: 2,
      isQuestion: true,
      matchedTerms: ['scam'],
    });
    expect(rejected).toMatchObject({
      label: '',
      topic: 'Other',
      confidence: 0,
      isQuestion: false,
      matchedTerms: [],
    });
  });

  it('keeps a valid topic when only the label is empty or unknown', () => {
    const kept = normalizeClassification({
      commentId: 'c1',
      label: 'happy' as 'positive',
      topic: 'Safety',
      confidence: 0.8,
      isQuestion: false,
      matchedTerms: ['injured'],
    });
    expect(kept.label).toBe('');
    expect(kept.topic).toBe('Safety');
    expect(kept.matchedTerms).toEqual(['injured']);
  });
});

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

describe('classifier egress', () => {
  it('has no outbound model client, OpenRouter key, or network call', () => {
    const root = path.resolve(__dirname, '../../src/social');
    const api = path.resolve(__dirname, '../../src/api/social');
    const files = [...walk(root), ...walk(api)].filter((file) => file.endsWith('.ts'));
    // Sandbox Graph outbound is allowed only in graph-client.ts (injectable fetcher).
    const bannedEverywhere = [
      'openrouter',
      'OPENROUTER',
      'axios',
      'node:http',
      'node:https',
      "from 'http'",
      "from 'https'",
      'http.request',
      'https.request',
      '@prisma/client',
      'api/orders',
      'api/tickets',
      'api/payments',
      'api/scanners',
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const base = path.basename(file);
      for (const term of bannedEverywhere) {
        expect(source.includes(term)).toBe(false);
      }
      if (base !== 'graph-client.ts') {
        expect(source.includes('fetch(')).toBe(false);
      }
      expect(source).not.toMatch(/\bcustomer\b/i);
      expect(source).not.toMatch(/\bbuyer\b/i);
      expect(source).not.toMatch(/ticket holder/i);
    }
    const previous = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'sk-or-should-be-ignored';
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('no egress'));
    try {
      expect(classify('injured near the front').topic).toBe('Safety');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previous;
    }
  });
});
