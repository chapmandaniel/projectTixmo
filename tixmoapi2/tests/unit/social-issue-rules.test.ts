import type { CommentClassifier } from '../../src/social/classifier';
import {
  evaluateIssues,
  sortIssuesBySeverityThenSentiment,
  waveSeverity,
  type RuleComment,
  type SocialIssue,
} from '../../src/social/issue-rules';
import {
  atLimitCount,
  automaticMode,
  bucketBaseline,
  canOverrideEventMapping,
  resolveEventMapping,
  resolveMode,
  tightestMode,
  waveFiresForMode,
  type EventSchedule,
} from '../../src/social/mode';
import { createRuleKeywordClassifier } from '../../src/social/classifier';

const rules = createRuleKeywordClassifier();

const event = (overrides: Partial<EventSchedule> = {}): EventSchedule => ({
  id: 'harbourfest-2027',
  name: 'Harbourfest 2027',
  timezone: 'UTC',
  startDatetime: null,
  endDatetime: null,
  salesStart: null,
  ticketTypeSalesStarts: [],
  ...overrides,
});

const comment = (
  id: string,
  text: string,
  createdAt: string,
  extra: Partial<RuleComment> = {}
): RuleComment => ({
  id,
  text,
  createdAt,
  ...extra,
});

const baseline = (nowIso: string, perDay: number, text: string): RuleComment[] => {
  const now = new Date(nowIso);
  const rows: RuleComment[] = [];
  for (let day = 1; day <= 14; day += 1) {
    const stamp = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - day,
        now.getUTCHours(),
        20,
        0
      )
    );
    for (let index = 0; index < perDay; index += 1) {
      rows.push(comment(`base-${day}-${index}`, text, stamp.toISOString()));
    }
  }
  return rows;
};

const stub = (fields: Partial<ReturnType<CommentClassifier['classify']>>): CommentClassifier => ({
  id: 'stub',
  version: 'test',
  classify: ({ id }) => ({
    commentId: id,
    label: '',
    topic: 'Other',
    confidence: 0,
    matchedTerms: [],
    isQuestion: false,
    hasNegation: false,
    isComplaint: false,
    classifierId: 'stub',
    modelVersion: 'test',
    ...fields,
  }),
});

describe('spike math', () => {
  it('uses the worked EVENT DAY examples', () => {
    expect(bucketBaseline(8, 'EVENT_DAY')).toBe(2);
    expect(waveFiresForMode(2, 'EVENT_DAY', 8)).toBe(false);
    expect(waveFiresForMode(3, 'EVENT_DAY', 8)).toBe(true);
    expect(waveFiresForMode(4, 'EVENT_DAY', 8)).toBe(true);
    expect(bucketBaseline(20, 'EVENT_DAY')).toBe(5);
    expect(atLimitCount(3, 7.5)).toBe(8);
    expect(waveFiresForMode(7, 'EVENT_DAY', 20)).toBe(false);
    expect(waveFiresForMode(8, 'EVENT_DAY', 20)).toBe(true);
    expect(waveFiresForMode(10, 'NORMAL', 1)).toBe(true);
    expect(waveFiresForMode(9, 'NORMAL', 1)).toBe(false);
    expect(waveFiresForMode(5, 'ON_SALE_DAY', 1)).toBe(true);
    expect(waveFiresForMode(4, 'ON_SALE_DAY', 1)).toBe(false);
  });

  it('opens one NORMAL wave at 10 comments and keeps 9 closed', () => {
    const now = new Date('2026-07-15T15:30:00.000Z');
    const comments = Array.from({ length: 10 }, (_, index) =>
      comment(`c${index}`, 'qr code', new Date(Date.UTC(2026, 6, 15, 15, index, 0)).toISOString())
    );
    const opened = evaluateIssues({ now, event: event(), comments, classifier: rules });
    expect(opened.mode).toBe('NORMAL');
    expect(opened.issues).toHaveLength(1);
    expect(opened.issues[0]).toMatchObject({
      kind: 'WAVE',
      topic: 'Ticketing',
      severity: 'MED',
      count: 10,
    });
    expect(opened.issues[0].ruleText).toContain('baseline 1/h');
    expect(opened.issues[0].ruleText).toContain('mode NORMAL');
    const below = evaluateIssues({
      now,
      event: event(),
      comments: comments.slice(0, 9),
      classifier: rules,
    });
    expect(below.issues).toHaveLength(0);
  });

  it('floors the hourly baseline at 1 and escalates a NORMAL wave at 3× the opening threshold', () => {
    const now = new Date('2026-07-15T15:40:00.000Z');
    const comments = Array.from({ length: 30 }, (_, index) =>
      comment(
        `c${index}`,
        'where is my ticket?',
        new Date(Date.UTC(2026, 6, 15, 15, index % 50, index)).toISOString()
      )
    );
    const result = evaluateIssues({ now, event: event(), comments, classifier: rules });
    expect(result.issues[0].severity).toBe('HIGH');
    expect(waveSeverity('Ticketing', 'NORMAL', 10, 10)).toBe('MED');
    expect(waveSeverity('Ticketing', 'NORMAL', 30, 10)).toBe('HIGH');
  });

  it('opens an EVENT DAY wave at 3 comments against an 8/h baseline', () => {
    const now = new Date('2026-07-15T15:10:00.000Z');
    const schedule = event({
      startDatetime: '2026-07-15T12:00:00.000Z',
      endDatetime: '2026-07-15T20:00:00.000Z',
    });
    const history = baseline(now.toISOString(), 8, 'the line');
    const current = [1, 2, 3].map((minute) =>
      comment(
        `now-${minute}`,
        'the line',
        new Date(Date.UTC(2026, 6, 15, 15, minute, 0)).toISOString()
      )
    );
    const at = evaluateIssues({
      now,
      event: schedule,
      comments: [...history, ...current],
      classifier: rules,
    });
    expect(at.mode).toBe('EVENT_DAY');
    expect(at.issues.filter((issue) => issue.kind === 'WAVE')).toHaveLength(1);
    expect(at.issues.find((issue) => issue.kind === 'WAVE')).toMatchObject({
      topic: 'Access/Entry',
      severity: 'HIGH',
      count: 3,
      baselinePerHour: 8,
    });
    const justBelow = evaluateIssues({
      now,
      event: schedule,
      comments: [...history, ...current.slice(0, 2)],
      classifier: rules,
    });
    expect(justBelow.issues.filter((issue) => issue.kind === 'WAVE')).toHaveLength(0);
  });

  it('lets later comments in the same bucket join the open wave', () => {
    const now = new Date('2026-07-15T15:30:00.000Z');
    const first = Array.from({ length: 10 }, (_, index) =>
      comment(`c${index}`, 'qr', new Date(Date.UTC(2026, 6, 15, 15, index, 0)).toISOString())
    );
    const opened = evaluateIssues({ now, event: event(), comments: first, classifier: rules });
    const later = comment('extra', 'qr', '2026-07-15T15:40:00.000Z');
    const joined = evaluateIssues({
      now: new Date('2026-07-15T15:45:00.000Z'),
      event: event(),
      comments: [...first, later],
      issues: opened.issues,
      classifier: rules,
    });
    const waves = joined.issues.filter((issue) => issue.kind === 'WAVE');
    expect(waves).toHaveLength(1);
    expect(waves[0].commentIds).toContain('extra');
  });
});

describe('single issues, unanswered, reopen, throttle, and sentiment', () => {
  const now = new Date('2026-07-15T18:00:00.000Z');

  it('opens HIGH for one Safety keyword and nothing for sentiment alone', () => {
    const safety = evaluateIssues({
      now,
      event: event(),
      comments: [comment('s1', 'someone was injured', '2026-07-15T17:50:00.000Z')],
      classifier: rules,
    });
    expect(safety.issues[0]).toMatchObject({ severity: 'HIGH', topic: 'Safety', kind: 'SINGLE' });
    expect(safety.issues[0].ruleText).toContain('injured');

    const mood = evaluateIssues({
      now,
      event: event(),
      comments: [comment('m1', 'this is terrible and urgent', '2026-07-15T17:00:00.000Z')],
      classifier: stub({ label: 'urgent', topic: 'Other', confidence: 0.99 }),
    });
    expect(mood.issues).toHaveLength(0);
  });

  it('opens a Refunds or Ticketing issue for a question or a negation, and reads labels only through the classifier', () => {
    const refund = evaluateIssues({
      now,
      event: event(),
      comments: [comment('r1', 'where is my refund?', '2026-07-15T17:00:00.000Z')],
      classifier: rules,
    });
    expect(refund.issues[0]).toMatchObject({ topic: 'Refunds', severity: 'MED' });
    const negation = evaluateIssues({
      now,
      event: event(),
      comments: [comment('t1', 'I never got the ticket', '2026-07-15T17:00:00.000Z')],
      classifier: rules,
    });
    expect(negation.issues[0]).toMatchObject({ topic: 'Ticketing', severity: 'MED' });
    expect(negation.issues[0].ruleText).toContain('negation');

    const ignored = evaluateIssues({
      now,
      event: event(),
      comments: [comment('x1', 'where is my refund?', '2026-07-15T17:00:00.000Z')],
      classifier: stub({ label: 'negative', topic: 'Other' }),
    });
    expect(ignored.issues).toHaveLength(0);
  });

  it('queues an unanswered question at exactly the mode limit and raises LOW to MED at 2×', () => {
    const asked = comment(
      'q1',
      'is there a bag policy?',
      new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
    );
    const atLimit = evaluateIssues({ now, event: event(), comments: [asked], classifier: rules });
    expect(atLimit.issues[0].tags).toContain('UNANSWERED');
    expect(atLimit.issues[0].ruleText).toContain('limit 4h');
    const older = comment(
      'q2',
      'is there parking?',
      new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString()
    );
    const doubled = evaluateIssues({ now, event: event(), comments: [older], classifier: rules });
    expect(doubled.issues[0].severity).toBe('MED');
    const justUnder = comment(
      'q3',
      'is there parking?',
      new Date(now.getTime() - 4 * 60 * 60 * 1000 + 1).toISOString()
    );
    expect(
      evaluateIssues({ now, event: event(), comments: [justUnder], classifier: rules }).issues
    ).toHaveLength(0);
  });

  it('reopens a handled wave at exactly 2 hours and leaves it handled after that', () => {
    const handled: SocialIssue = {
      id: 'wave:Ticketing:old',
      kind: 'WAVE',
      topic: 'Ticketing',
      severity: 'MED',
      state: 'HANDLED',
      ruleText: 'old',
      commentIds: ['old'],
      tags: ['WAVE'],
      bucketStart: '2026-07-15T12:00',
      handledAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      openedAt: '2026-07-15T12:00:00.000Z',
      mode: 'NORMAL',
      activity: [],
    };
    const reopened = evaluateIssues({
      now,
      event: event(),
      comments: [comment('old', 'qr', handled.openedAt), comment('fresh', 'qr', now.toISOString())],
      issues: [handled],
      classifier: rules,
    });
    expect(reopened.issues.find((issue) => issue.id === handled.id)?.state).toBe('IN_PROGRESS');
    expect(
      reopened.issues
        .find((issue) => issue.id === handled.id)
        ?.activity.map((entry) => entry.text)
        .join(' ')
    ).toContain('Reopened by rule');

    const tooLate = evaluateIssues({
      now,
      event: event(),
      comments: [comment('old', 'qr', handled.openedAt), comment('fresh', 'qr', now.toISOString())],
      issues: [
        { ...handled, handledAt: new Date(now.getTime() - 2 * 60 * 60 * 1000 - 1).toISOString() },
      ],
      classifier: rules,
    });
    expect(tooLate.issues.find((issue) => issue.id === handled.id)?.state).toBe('HANDLED');
    expect(tooLate.issues.some((issue) => issue.id !== handled.id && issue.kind === 'WAVE')).toBe(
      false
    );
  });

  it('sends one alert per wave until 30 minutes have elapsed', () => {
    const comments = Array.from({ length: 10 }, (_, index) =>
      comment(`c${index}`, 'qr', new Date(Date.UTC(2026, 6, 15, 15, index, 0)).toISOString())
    );
    const firstNow = new Date('2026-07-15T15:20:00.000Z');
    const first = evaluateIssues({ now: firstNow, event: event(), comments, classifier: rules });
    expect(first.alerts[0].suppressed).toBe(false);
    const second = evaluateIssues({
      now: new Date(firstNow.getTime() + 30 * 60 * 1000 - 1),
      event: event(),
      comments: [...comments, comment('more', 'qr', '2026-07-15T15:40:00.000Z')],
      issues: first.issues,
      classifier: rules,
    });
    expect(second.alerts.some((alert) => alert.suppressed)).toBe(true);
    const third = evaluateIssues({
      now: new Date(firstNow.getTime() + 30 * 60 * 1000),
      event: event(),
      comments: [...comments, comment('more', 'qr', '2026-07-15T15:40:00.000Z')],
      issues: first.issues,
      classifier: rules,
    });
    expect(third.alerts.some((alert) => !alert.suppressed)).toBe(true);
  });

  it('sorts sentiment inside a severity and does not change that severity', () => {
    const low: SocialIssue = {
      id: 'low',
      kind: 'SINGLE',
      topic: 'Other',
      severity: 'LOW',
      state: 'NEW',
      ruleText: 'manual',
      commentIds: ['low-comment'],
      tags: [],
      openedAt: now.toISOString(),
      mode: 'NORMAL',
      activity: [],
    };
    const high: SocialIssue = {
      ...low,
      id: 'high',
      severity: 'HIGH',
      topic: 'Safety',
      commentIds: ['high-comment'],
    };
    const sorted = sortIssuesBySeverityThenSentiment(
      [low, high],
      [
        {
          commentId: 'low-comment',
          label: 'urgent',
          topic: 'Other',
          confidence: 0.9,
          matchedTerms: [],
          isQuestion: false,
          hasNegation: false,
          isComplaint: false,
          classifierId: 'stub',
          modelVersion: 'test',
        },
        {
          commentId: 'high-comment',
          label: 'positive',
          topic: 'Safety',
          confidence: 0.4,
          matchedTerms: [],
          isQuestion: false,
          hasNegation: false,
          isComplaint: false,
          classifierId: 'stub',
          modelVersion: 'test',
        },
      ]
    );
    expect(sorted.map((issue) => issue.id)).toEqual(['high', 'low']);
    expect(sorted.map((issue) => issue.severity)).toEqual(['HIGH', 'LOW']);
    const again = evaluateIssues({
      now,
      event: event(),
      comments: [comment('low-comment', 'hello', now.toISOString())],
      issues: [low],
      classifier: stub({ label: 'urgent', topic: 'Other', confidence: 1 }),
    });
    expect(again.issues.find((issue) => issue.id === 'low')?.severity).toBe('LOW');
  });

  it('stores an empty label and a manual flag without posting', () => {
    const result = evaluateIssues({
      now,
      event: event(),
      comments: [comment('plain', 'hello there', now.toISOString())],
      manualFlags: [{ commentId: 'plain', topic: 'Lineup', actorName: 'Alex P.' }],
      classifier: rules,
    });
    expect(result.classifications[0].label).toBe('');
    expect(result.issues[0].ruleText).toContain('Manual flag by Alex P.');
    expect(result.issues[0].severity).toBe('LOW');
  });
});

describe('modes, holds, and event mapping', () => {
  const zone = 'America/St_Johns';

  it('treats event day as start minus 6 hours through end, inclusive', () => {
    const schedule = event({
      timezone: zone,
      startDatetime: '2027-07-10T18:30:00.000Z',
      endDatetime: '2027-07-13T01:30:00.000Z',
    });
    expect(automaticMode(schedule, new Date('2027-07-10T12:29:59.999Z'))).toBe('NORMAL');
    expect(automaticMode(schedule, new Date('2027-07-10T12:30:00.000Z'))).toBe('EVENT_DAY');
    expect(automaticMode(schedule, new Date('2027-07-13T01:30:00.000Z'))).toBe('EVENT_DAY');
    expect(automaticMode(schedule, new Date('2027-07-13T01:30:00.001Z'))).toBe('NORMAL');
  });

  it('uses the full local calendar date of either sales start and prefers EVENT DAY', () => {
    const onSale = event({
      timezone: zone,
      salesStart: '2027-07-01T14:00:00.000Z',
    });
    expect(automaticMode(onSale, new Date('2027-07-01T02:30:00.000Z'))).toBe('ON_SALE_DAY');
    expect(automaticMode(onSale, new Date('2027-07-02T02:29:59.999Z'))).toBe('ON_SALE_DAY');
    expect(automaticMode(onSale, new Date('2027-07-02T02:30:00.000Z'))).toBe('NORMAL');
    const ticketType = event({
      timezone: zone,
      ticketTypeSalesStarts: ['2027-08-01T14:00:00.000Z'],
    });
    expect(automaticMode(ticketType, new Date('2027-08-01T12:00:00.000Z'))).toBe('ON_SALE_DAY');
    expect(automaticMode(event({ timezone: zone }), new Date('2027-07-01T12:00:00.000Z'))).toBe(
      'NORMAL'
    );
    const both = event({
      timezone: zone,
      startDatetime: '2027-07-10T18:30:00.000Z',
      endDatetime: '2027-07-13T01:30:00.000Z',
      salesStart: '2027-07-10T14:00:00.000Z',
    });
    expect(automaticMode(both, new Date('2027-07-10T16:00:00.000Z'))).toBe('EVENT_DAY');
  });

  it('holds a named mode until the instant and then returns to automatic', () => {
    const schedule = event();
    const now = new Date('2026-07-15T12:00:00.000Z');
    expect(
      resolveMode(schedule, now, { mode: 'ON_SALE_DAY', until: '2026-07-16T00:00:00.000Z' })
    ).toEqual({ mode: 'ON_SALE_DAY', source: 'hold' });
    expect(
      resolveMode(schedule, now, { mode: 'EVENT_DAY', until: '2026-07-15T12:00:00.000Z' })
    ).toEqual({ mode: 'NORMAL', source: 'automatic' });
    expect(() =>
      resolveMode(schedule, now, { mode: 'TIGHT' as 'NORMAL', until: '2026-07-16T00:00:00.000Z' })
    ).toThrow(/NORMAL, ON-SALE DAY, or EVENT DAY/);
  });

  it('shows the tightest mode across events', () => {
    const quiet = event({ id: 'quiet', name: 'Quiet' });
    const live = event({
      id: 'live',
      name: 'Harbourfest 2027',
      startDatetime: '2026-07-15T12:00:00.000Z',
      endDatetime: '2026-07-15T20:00:00.000Z',
    });
    expect(tightestMode([quiet, live], new Date('2026-07-15T15:00:00.000Z'))).toMatchObject({
      mode: 'EVENT_DAY',
      eventName: 'Harbourfest 2027',
    });
  });

  it('maps a post by the edition range and keeps an admin override', () => {
    const first = event({
      id: 'early',
      name: 'Early',
      startDatetime: '2026-07-10T16:00:00.000Z',
      endDatetime: '2026-07-12T16:00:00.000Z',
      salesStart: '2026-07-01T12:00:00.000Z',
    });
    const second = event({
      id: 'late',
      name: 'Late',
      startDatetime: '2026-07-11T16:00:00.000Z',
      endDatetime: '2026-07-20T16:00:00.000Z',
    });
    expect(
      resolveEventMapping({ postTime: '2026-07-02T12:00:00.000Z', events: [first] }).eventId
    ).toBe('early');
    expect(
      resolveEventMapping({ postTime: '2026-06-01T12:00:00.000Z', events: [first] }).source
    ).toBe('unmapped');
    expect(
      resolveEventMapping({ postTime: '2026-07-11T18:00:00.000Z', events: [first, second] }).eventId
    ).toBe('late');
    const tiedEarly = event({
      id: 'tied-early',
      salesStart: '2026-07-01T12:00:00.000Z',
      startDatetime: '2026-07-10T12:00:00.000Z',
      endDatetime: '2026-07-20T12:00:00.000Z',
    });
    const tiedLater = event({
      id: 'tied-later',
      salesStart: '2026-07-01T12:00:00.000Z',
      startDatetime: '2026-07-12T12:00:00.000Z',
      endDatetime: '2026-07-20T12:00:00.000Z',
    });
    expect(
      resolveEventMapping({ postTime: '2026-07-11T12:00:00.000Z', events: [tiedEarly, tiedLater] })
        .eventId
    ).toBe('tied-later');
    expect(
      resolveEventMapping({
        postTime: '2026-08-01T12:00:00.000Z',
        events: [first],
        overrideEventId: 'kept',
      })
    ).toEqual({ eventId: 'kept', source: 'override' });
    expect(canOverrideEventMapping('ADMIN')).toBe(true);
    expect(canOverrideEventMapping('TEAM_MEMBER')).toBe(false);
  });
});
