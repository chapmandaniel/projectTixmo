import {
  normalizeClassification,
  type CommentClassification,
  type CommentClassifier,
} from './classifier';
import type { Topic } from './keywords';
import {
  DEFAULT_MODE_THRESHOLDS,
  atLimitCount,
  bucketBaseline,
  resolveMode,
  shiftDateKey,
  zonedParts,
  type EventSchedule,
  type ModeHold,
  type ModeThreshold,
  type ThresholdMode,
} from './mode';

export type IssueState = 'NEW' | 'IN_PROGRESS' | 'HANDLED' | 'DISMISSED';
export type Severity = 'HIGH' | 'MED' | 'LOW';

export interface RuleComment {
  id: string;
  text: string;
  createdAt: string;
  authorIsPage?: boolean;
  hasPageReply?: boolean;
}

export interface SocialIssue {
  id: string;
  kind: 'WAVE' | 'SINGLE';
  topic: Topic;
  severity: Severity;
  state: IssueState;
  ruleText: string;
  commentIds: string[];
  tags: string[];
  bucketStart?: string;
  handledAt?: string | null;
  lastAlertAt?: string | null;
  openedAt: string;
  mode: ThresholdMode;
  count?: number;
  baselinePerHour?: number;
  activity: { at: string; text: string }[];
}

export interface ManualFlag {
  commentId: string;
  topic: Topic;
  severity?: Severity;
  actorName: string;
}

export interface EvaluateInput {
  now: Date;
  event: EventSchedule;
  hold?: ModeHold | null;
  comments: readonly RuleComment[];
  issues?: readonly SocialIssue[];
  classifier: CommentClassifier;
  thresholds?: Partial<Record<ThresholdMode, Partial<ModeThreshold>>>;
  manualFlags?: readonly ManualFlag[];
  highEmailEnabled?: boolean;
}

export interface AlertPlan {
  issueId: string;
  at: string;
  suppressed: boolean;
  channels: Array<'in-app' | 'email'>;
}

export interface EvaluateResult {
  mode: ThresholdMode;
  modeSource: 'automatic' | 'hold';
  classifications: CommentClassification[];
  issues: SocialIssue[];
  alerts: AlertPlan[];
}

const TOPICS: Topic[] = ['Safety', 'Ticketing', 'Refunds', 'Access/Entry', 'Lineup', 'Other'];
const TWO_HOURS = 2 * 60 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

const modeLabel = (mode: ThresholdMode): string =>
  mode === 'ON_SALE_DAY' ? 'ON-SALE DAY' : mode === 'EVENT_DAY' ? 'EVENT DAY' : 'NORMAL';

const cloneIssue = (issue: SocialIssue): SocialIssue => ({
  ...issue,
  commentIds: [...issue.commentIds],
  tags: [...issue.tags],
  activity: issue.activity.map((entry) => ({ ...entry })),
});

const resolvedThresholds = (
  overrides: EvaluateInput['thresholds']
): Record<ThresholdMode, ModeThreshold> => {
  const next = {
    NORMAL: { ...DEFAULT_MODE_THRESHOLDS.NORMAL },
    ON_SALE_DAY: { ...DEFAULT_MODE_THRESHOLDS.ON_SALE_DAY },
    EVENT_DAY: { ...DEFAULT_MODE_THRESHOLDS.EVENT_DAY },
  };
  for (const mode of Object.keys(next) as ThresholdMode[]) {
    next[mode] = { ...next[mode], ...(overrides?.[mode] || {}) };
  }
  return next;
};

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
};

const inBucket = (
  createdAt: string,
  now: Date,
  timeZone: string,
  windowMinutes: number
): boolean => {
  const comment = zonedParts(new Date(createdAt), timeZone);
  const current = zonedParts(now, timeZone);
  if (comment.key !== current.key || comment.hour !== current.hour) return false;
  if (windowMinutes >= 60) return true;
  return Math.floor(comment.minute / windowMinutes) === Math.floor(current.minute / windowMinutes);
};

const bucketStartIso = (now: Date, timeZone: string, windowMinutes: number): string => {
  const parts = zonedParts(now, timeZone);
  const slot = windowMinutes >= 60 ? 0 : Math.floor(parts.minute / windowMinutes) * windowMinutes;
  return `${parts.key}T${String(parts.hour).padStart(2, '0')}:${String(slot).padStart(2, '0')}`;
};

const hourlyBaseline = (
  comments: readonly RuleComment[],
  topicOf: (id: string) => Topic,
  topic: Topic,
  now: Date,
  timeZone: string
): number => {
  const current = zonedParts(now, timeZone);
  const samples: number[] = [];
  for (let ago = 1; ago <= 14; ago += 1) {
    const key = shiftDateKey(current.key, -ago);
    const count = comments.filter((comment) => {
      if (comment.authorIsPage) return false;
      if (topicOf(comment.id) !== topic) return false;
      const parts = zonedParts(new Date(comment.createdAt), timeZone);
      return parts.key === key && parts.hour === current.hour;
    }).length;
    samples.push(count);
  }
  return Math.max(1, median(samples));
};

const quoteTerms = (terms: readonly string[]): string =>
  terms.length ? terms.map((term) => `"${term}"`).join(', ') : 'none';

export const waveSeverity = (
  topic: Topic,
  mode: ThresholdMode,
  count: number,
  openingThreshold: number
): Severity => {
  if (topic === 'Safety' || mode === 'ON_SALE_DAY' || mode === 'EVENT_DAY') return 'HIGH';
  if (count >= 3 * openingThreshold) return 'HIGH';
  return 'MED';
};

const SEVERITY_RANK: Record<Severity, number> = { HIGH: 0, MED: 1, LOW: 2 };
const LABEL_RANK: Record<string, number> = {
  urgent: 0,
  negative: 1,
  neutral: 2,
  positive: 3,
  '': 4,
};

export const sortIssuesBySeverityThenSentiment = (
  issues: readonly SocialIssue[],
  classifications: readonly CommentClassification[]
): SocialIssue[] => {
  const byComment = new Map(classifications.map((item) => [item.commentId, item]));
  const rankOf = (issue: SocialIssue): number => {
    const ranks = issue.commentIds.map((id) => LABEL_RANK[byComment.get(id)?.label || ''] ?? 4);
    return ranks.length ? Math.min(...ranks) : 4;
  };
  return [...issues].sort((left, right) => {
    const severity = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
    if (severity !== 0) return severity;
    return rankOf(left) - rankOf(right);
  });
};

const memberIds = (issues: readonly SocialIssue[]): Set<string> =>
  new Set(issues.flatMap((issue) => issue.commentIds));

export const evaluateIssues = (input: EvaluateInput): EvaluateResult => {
  const classified = new Map<string, CommentClassification>();
  for (const comment of input.comments) {
    const raw = input.classifier.classify({ id: comment.id, text: comment.text });
    classified.set(comment.id, normalizeClassification({ ...raw, commentId: comment.id }));
  }
  const topicOf = (id: string): Topic => classified.get(id)?.topic || 'Other';
  const mode = resolveMode(input.event, input.now, input.hold);
  const threshold = resolvedThresholds(input.thresholds)[mode.mode];
  const issues = (input.issues || []).map(cloneIssue);
  const alerts: AlertPlan[] = [];
  const nowIso = input.now.toISOString();
  const bucket = bucketStartIso(input.now, input.event.timezone, threshold.windowMinutes);
  const fan = input.comments.filter((comment) => !comment.authorIsPage);

  const planAlert = (issue: SocialIssue, highEmail: boolean): void => {
    const elapsed = issue.lastAlertAt
      ? input.now.getTime() - Date.parse(issue.lastAlertAt)
      : Infinity;
    const suppressed = Number.isFinite(elapsed) && elapsed < THIRTY_MINUTES;
    const channels: AlertPlan['channels'] = ['in-app'];
    if (highEmail && issue.severity === 'HIGH' && input.highEmailEnabled !== false)
      channels.push('email');
    alerts.push({
      issueId: issue.id,
      at: nowIso,
      suppressed,
      channels: suppressed ? [] : channels,
    });
    if (!suppressed) {
      issue.lastAlertAt = nowIso;
      issue.activity.push({
        at: nowIso,
        text: channels.includes('email')
          ? 'Alert sent: in-app badge; HIGH email to the assignee and owners, or to org admins if unassigned'
          : 'Alert sent: in-app badge',
      });
    }
  };

  for (const topic of TOPICS) {
    const baseline = hourlyBaseline(fan, topicOf, topic, input.now, input.event.timezone);
    const windowBaseline = bucketBaseline(baseline, mode.mode);
    const members = fan.filter(
      (comment) =>
        topicOf(comment.id) === topic &&
        inBucket(comment.createdAt, input.now, input.event.timezone, threshold.windowMinutes)
    );
    const count = members.length;
    const fires = count >= threshold.minComments && count >= threshold.multiplier * windowBaseline;
    const opening = atLimitCount(threshold.minComments, threshold.multiplier * windowBaseline);
    const openWave = issues.find(
      (issue) =>
        issue.kind === 'WAVE' &&
        issue.topic === topic &&
        issue.bucketStart === bucket &&
        (issue.state === 'NEW' || issue.state === 'IN_PROGRESS')
    );
    const handled = issues
      .filter(
        (issue) =>
          issue.kind === 'WAVE' &&
          issue.topic === topic &&
          issue.state === 'HANDLED' &&
          issue.handledAt
      )
      .sort(
        (left, right) => Date.parse(right.handledAt || '') - Date.parse(left.handledAt || '')
      )[0];
    const withinTwoHours = handled
      ? fan.filter((comment) => {
          if (topicOf(comment.id) !== topic) return false;
          const created = Date.parse(comment.createdAt);
          const handledAt = Date.parse(handled.handledAt || '');
          return (
            Number.isFinite(created) && created >= handledAt && created - handledAt <= TWO_HOURS
          );
        })
      : [];

    if (withinTwoHours.length && handled && !openWave) {
      const added = withinTwoHours
        .map((comment) => comment.id)
        .filter((id) => !handled.commentIds.includes(id));
      handled.commentIds.push(...added);
      handled.state = 'IN_PROGRESS';
      handled.tags = [...new Set([...handled.tags, 'WAVE'])];
      handled.activity.push({
        at: nowIso,
        text: 'Reopened by rule: matching comment within 2 hours of handled.',
      });
      planAlert(handled, true);
      continue;
    }

    if (openWave) {
      const added = members
        .map((comment) => comment.id)
        .filter((id) => !openWave.commentIds.includes(id));
      if (added.length) {
        openWave.commentIds.push(...added);
        openWave.count = openWave.commentIds.length;
        planAlert(openWave, true);
      }
      continue;
    }

    if (!fires || !members.length) continue;
    const terms = [
      ...new Set(members.flatMap((comment) => classified.get(comment.id)?.matchedTerms || [])),
    ];
    const windowLabel =
      threshold.windowMinutes >= 60 ? 'hour' : `${threshold.windowMinutes}-minute bucket`;
    const issue: SocialIssue = {
      id: `wave:${topic}:${bucket}`,
      kind: 'WAVE',
      topic,
      severity: waveSeverity(topic, mode.mode, count, opening),
      state: 'NEW',
      ruleText: `${topic} spike: ${count} comments in this ${windowLabel} vs baseline ${baseline}/h (b=${windowBaseline}, ${threshold.multiplier}×, min ${threshold.minComments}, mode ${modeLabel(mode.mode)}). Matched: ${quoteTerms(terms)}.`,
      commentIds: members.map((comment) => comment.id),
      tags: ['WAVE'],
      bucketStart: bucket,
      handledAt: null,
      lastAlertAt: null,
      openedAt: nowIso,
      mode: mode.mode,
      count,
      baselinePerHour: baseline,
      activity: [
        {
          at: nowIso,
          text: `Opened by rule ${topic} spike (${count} vs baseline ${baseline}/h, mode ${modeLabel(mode.mode)}).`,
        },
      ],
    };
    issues.push(issue);
    planAlert(issue, true);
  }

  const taken = () => memberIds(issues);
  const limitMs = threshold.unansweredMinutes * 60 * 1000;

  for (const comment of fan) {
    if (taken().has(comment.id)) continue;
    const classification = classified.get(comment.id)!;
    const terms = quoteTerms(classification.matchedTerms);
    if (classification.topic === 'Safety') {
      issues.push({
        id: `single:safety:${comment.id}`,
        kind: 'SINGLE',
        topic: 'Safety',
        severity: 'HIGH',
        state: 'NEW',
        ruleText: `Safety keyword on one comment. Matched: ${terms}. Mode ${modeLabel(mode.mode)}.`,
        commentIds: [comment.id],
        tags: [],
        openedAt: nowIso,
        mode: mode.mode,
        activity: [{ at: nowIso, text: `Opened by rule Safety keyword. Matched: ${terms}.` }],
      });
      continue;
    }
    if (
      (classification.topic === 'Refunds' || classification.topic === 'Ticketing') &&
      (classification.isQuestion || classification.hasNegation)
    ) {
      const reason = classification.isQuestion ? 'a question' : 'a negation';
      issues.push({
        id: `single:${classification.topic}:${comment.id}`,
        kind: 'SINGLE',
        topic: classification.topic,
        severity: 'MED',
        state: 'NEW',
        ruleText: `${classification.topic} keyword with ${reason}. Matched: ${terms}. Mode ${modeLabel(mode.mode)}.`,
        commentIds: [comment.id],
        tags: [],
        openedAt: nowIso,
        mode: mode.mode,
        activity: [
          {
            at: nowIso,
            text: `Opened by rule ${classification.topic} ${reason}. Matched: ${terms}.`,
          },
        ],
      });
    }
  }

  for (const comment of fan) {
    const classification = classified.get(comment.id)!;
    const age = input.now.getTime() - Date.parse(comment.createdAt);
    const unanswered =
      (classification.isQuestion || classification.isComplaint) &&
      !comment.hasPageReply &&
      age >= limitMs;
    if (!unanswered) continue;
    const existing = issues.find((issue) => issue.commentIds.includes(comment.id));
    const hours = Math.round((age / 3600000) * 10) / 10;
    const limitLabel =
      threshold.unansweredMinutes % 60 === 0
        ? `${threshold.unansweredMinutes / 60}h`
        : `${threshold.unansweredMinutes} min`;
    if (existing) {
      if (!existing.tags.includes('UNANSWERED')) existing.tags.push('UNANSWERED');
      if (age >= 2 * limitMs && existing.severity === 'LOW') {
        existing.severity = 'MED';
        existing.activity.push({
          at: nowIso,
          text: `Severity set to MED: unanswered for ${hours}h, at least twice the ${limitLabel} limit.`,
        });
      }
      continue;
    }
    const severity: Severity = age >= 2 * limitMs ? 'MED' : 'LOW';
    issues.push({
      id: `single:unanswered:${comment.id}`,
      kind: 'SINGLE',
      topic: classification.topic,
      severity,
      state: 'NEW',
      ruleText: `Unanswered ${classification.isQuestion ? 'question' : 'complaint'} for ${hours}h (limit ${limitLabel}, mode ${modeLabel(mode.mode)}).`,
      commentIds: [comment.id],
      tags: ['UNANSWERED'],
      openedAt: nowIso,
      mode: mode.mode,
      activity: [{ at: nowIso, text: `Opened by rule unanswered past ${limitLabel}.` }],
    });
  }

  for (const flag of input.manualFlags || []) {
    if (taken().has(flag.commentId)) continue;
    const classification = classified.get(flag.commentId);
    const topic = flag.topic || classification?.topic || 'Other';
    issues.push({
      id: `single:manual:${flag.commentId}`,
      kind: 'SINGLE',
      topic,
      severity: flag.severity || 'LOW',
      state: 'NEW',
      ruleText: `Manual flag by ${flag.actorName}. Topic ${topic}.`,
      commentIds: [flag.commentId],
      tags: [],
      openedAt: nowIso,
      mode: mode.mode,
      activity: [{ at: nowIso, text: `Opened by manual flag from ${flag.actorName}.` }],
    });
  }

  return {
    mode: mode.mode,
    modeSource: mode.source,
    classifications: [...classified.values()],
    issues,
    alerts,
  };
};
