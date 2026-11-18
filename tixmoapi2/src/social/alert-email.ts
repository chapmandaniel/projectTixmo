/** Metadata and a dashboard link only. No comment text, handles, names, avatars, or captions. */

const FORBIDDEN_KEYS = new Set([
  'body',
  'caption',
  'comment',
  'commentbody',
  'commenter',
  'commenttext',
  'comments',
  'excerpt',
  'handle',
  'handles',
  'message',
  'textbody',
  'username',
  'avatar',
  'authorhandle',
]);

export class SocialEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SocialEmailError';
  }
}

export interface RenderedSocialEmail {
  kind: 'high' | 'digest';
  to: string[];
  from: string;
  subject: string;
  text: string;
  html: string;
  metadata: Record<string, string>;
}

const rejectForbidden = (value: object): void => {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      throw new SocialEmailError('Social email cannot include comment text or handles.');
    }
  }
};

const uniqueEmails = (emails: readonly (string | null | undefined)[]): string[] => [
  ...new Set(emails.map((email) => (email || '').trim().toLowerCase()).filter(Boolean)),
];

export const highAlertRecipients = (input: {
  assigneeEmail?: string | null;
  ownerEmails?: readonly string[];
  adminEmails?: readonly string[];
}): string[] => {
  if (input.assigneeEmail?.trim()) {
    return uniqueEmails([input.assigneeEmail, ...(input.ownerEmails || [])]);
  }
  return uniqueEmails(input.adminEmails || []);
};

export interface HighAlertInput {
  organizationId: string;
  from?: string;
  to: string[];
  severity: string;
  topic: string;
  state: string;
  commentCount: number;
  eventName: string;
  detectedAt: string;
  unansweredDuration?: string | null;
  assignee?: string | null;
  ruleName: string;
  dashboardUrl: string;
}

export const buildHighAlertEmail = (input: HighAlertInput): RenderedSocialEmail => {
  rejectForbidden(input);
  const unanswered = input.unansweredDuration?.trim() || '—';
  const assignee = input.assignee?.trim() || 'Unassigned';
  const lines = [
    `[${input.severity}] ${input.topic} · ${input.state}`,
    `Event: ${input.eventName}`,
    `Comments in this issue: ${input.commentCount}`,
    `Detected: ${input.detectedAt}`,
    `Unanswered: ${unanswered}`,
    `Assignee: ${assignee}`,
    `Rule: ${input.ruleName}`,
    `Open in Tixmo: ${input.dashboardUrl}`,
  ];
  const text = lines.join('\n');
  return {
    kind: 'high',
    to: uniqueEmails(input.to),
    from: input.from?.trim() || '',
    subject: `[${input.severity}] ${input.topic} · ${input.eventName}`,
    text,
    html: `<p>${lines.map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>')}</p>`,
    metadata: {
      severity: input.severity,
      topic: input.topic,
      state: input.state,
      commentCount: String(input.commentCount),
      eventName: input.eventName,
      detectedAt: input.detectedAt,
      unansweredDuration: unanswered,
      assignee,
      ruleName: input.ruleName,
      dashboardUrl: input.dashboardUrl,
    },
  };
};

export interface DigestPost {
  postedAt: string;
  platform: string;
  reach: string;
}

export interface DigestInput {
  organizationId: string;
  from?: string;
  to: string[];
  eventName: string;
  openBySeverity: Record<string, number>;
  openByTopic: Record<string, number>;
  unansweredCount: number;
  oldestUnansweredAge: string;
  newYesterday: number;
  handledYesterday: number;
  topPost?: DigestPost | null;
  dashboardUrl: string;
}

export const buildDigestEmail = (input: DigestInput): RenderedSocialEmail => {
  rejectForbidden(input);
  if (input.topPost) rejectForbidden(input.topPost);
  const severity = Object.entries(input.openBySeverity)
    .map(([label, count]) => `${label} ${count}`)
    .join(', ');
  const topics = Object.entries(input.openByTopic)
    .map(([label, count]) => `${label} ${count}`)
    .join(', ');
  const top = input.topPost
    ? `${input.topPost.postedAt} · ${input.topPost.platform} · reach ${input.topPost.reach}`
    : 'none';
  const lines = [
    `Daily social digest · ${input.eventName}`,
    `Open by severity: ${severity || 'none'}`,
    `Open by topic: ${topics || 'none'}`,
    `Unanswered past the limit: ${input.unansweredCount} (oldest ${input.oldestUnansweredAge})`,
    `Yesterday: ${input.newYesterday} new, ${input.handledYesterday} handled`,
    `Top post yesterday: ${top}`,
    `Open in Tixmo: ${input.dashboardUrl}`,
  ];
  const text = lines.join('\n');
  return {
    kind: 'digest',
    to: uniqueEmails(input.to),
    from: input.from?.trim() || '',
    subject: `Social digest · ${input.eventName}`,
    text,
    html: `<p>${lines.map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>')}</p>`,
    metadata: {
      eventName: input.eventName,
      openBySeverity: severity,
      openByTopic: topics,
      unansweredCount: String(input.unansweredCount),
      oldestUnansweredAge: input.oldestUnansweredAge,
      newYesterday: String(input.newYesterday),
      handledYesterday: String(input.handledYesterday),
      topPost: top,
      dashboardUrl: input.dashboardUrl,
    },
  };
};

export const assertMetadataOnly = (
  payload: unknown,
  samples: { commentText?: string; handle?: string; caption?: string } = {}
): void => {
  const json = JSON.stringify(payload);
  const lowered = json.toLowerCase();
  for (const key of FORBIDDEN_KEYS) {
    if (new RegExp(`"${key}"\\s*:`, 'i').test(json)) {
      throw new SocialEmailError('Social email cannot include comment text or handles.');
    }
  }
  for (const sample of [samples.commentText, samples.handle, samples.caption]) {
    if (sample && sample.length > 0 && lowered.includes(sample.toLowerCase())) {
      throw new SocialEmailError('Social email cannot include comment text or handles.');
    }
  }
};
