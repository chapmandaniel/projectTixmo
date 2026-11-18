/** Confirmed retention. Not a QA pass/fail gate in the cut, and not pending. */

export const DEFAULT_COMMENT_RETENTION_DAYS = 14;

export type RetentionIssueState = 'NEW' | 'IN_PROGRESS' | 'HANDLED' | 'DISMISSED';

export type RetentionReason = 'within-ttl' | 'open-issue-hold' | 'expired';

export const commentRetentionDecision = (input: {
  now: Date;
  createdAt: Date;
  retentionDays?: number;
  issueStates?: readonly RetentionIssueState[];
}): { keepBodyAndHandle: boolean; reason: RetentionReason } => {
  const days = input.retentionDays ?? DEFAULT_COMMENT_RETENTION_DAYS;
  const open = (input.issueStates || []).some(
    (state) => state === 'NEW' || state === 'IN_PROGRESS'
  );
  if (open) return { keepBodyAndHandle: true, reason: 'open-issue-hold' };
  const ttl = days * 24 * 60 * 60 * 1000;
  const age = input.now.getTime() - new Date(input.createdAt).getTime();
  if (age < ttl) return { keepBodyAndHandle: true, reason: 'within-ttl' };
  return { keepBodyAndHandle: false, reason: 'expired' };
};
