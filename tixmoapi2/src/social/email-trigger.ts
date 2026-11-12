import { ApiError } from '../utils/ApiError';
import { readSocialConfig } from './config';
import { socialMailShouldCapture } from './email-capture';
import { deliverDigest, deliverHighAlert } from './social-mailer';
import { emitSocialLog, type SocialLogger } from './log';

/**
 * Guarded capture trigger for Labs/AC-11 proof.
 * Only works when SOCIAL_EMAIL_CAPTURE=true or the process is in Labs.
 * Payloads are metadata + dashboard link only.
 */
export const triggerCapturedSocialEmail = async (input: {
  organizationId: string;
  role?: string | null;
  kind: 'high' | 'digest';
  severity?: string;
  topic?: string;
  state?: string;
  commentCount?: number;
  eventName?: string;
  detectedAt?: string;
  unansweredDuration?: string | null;
  assignee?: string | null;
  ruleName?: string;
  dashboardUrl?: string;
  openBySeverity?: Record<string, number>;
  openByTopic?: Record<string, number>;
  unansweredCount?: number;
  oldestUnansweredAge?: string;
  newYesterday?: number;
  handledYesterday?: number;
  topPost?: { postedAt: string; platform: string; reach: string } | null;
  logger?: SocialLogger;
}) => {
  if (input.role !== 'OWNER' && input.role !== 'ADMIN') {
    throw ApiError.forbidden('Org admins can trigger captured social email');
  }
  const config = readSocialConfig();
  if (!config.enabled) throw ApiError.notFound('Social Command Center is not enabled');
  if (!socialMailShouldCapture(process.env)) {
    throw ApiError.forbidden('Social email capture is not enabled');
  }

  const dashboardUrl = input.dashboardUrl || '/social';
  if (input.kind === 'high') {
    const result = await deliverHighAlert(
      {
        organizationId: input.organizationId,
        to: [],
        severity: input.severity || 'HIGH',
        topic: input.topic || 'Ticketing',
        state: input.state || 'NEW',
        commentCount: input.commentCount ?? 0,
        eventName: input.eventName || 'All events',
        detectedAt: input.detectedAt || new Date().toISOString(),
        unansweredDuration: input.unansweredDuration || null,
        assignee: input.assignee || null,
        ruleName: input.ruleName || 'manual-capture',
        dashboardUrl,
      },
      process.env,
      { logger: input.logger }
    );
    emitSocialLog(input.logger, 'info', 'email.trigger', {
      organizationId: input.organizationId,
      trigger: 'high',
    });
    return result;
  }

  const result = await deliverDigest(
    {
      organizationId: input.organizationId,
      to: [],
      eventName: input.eventName || 'All events',
      openBySeverity: input.openBySeverity || { HIGH: 0, MED: 0, LOW: 0 },
      openByTopic: input.openByTopic || {},
      unansweredCount: input.unansweredCount ?? 0,
      oldestUnansweredAge: input.oldestUnansweredAge || '—',
      newYesterday: input.newYesterday ?? 0,
      handledYesterday: input.handledYesterday ?? 0,
      topPost: input.topPost || { postedAt: '—', platform: 'FB', reach: '0' },
      dashboardUrl,
    },
    process.env,
    { logger: input.logger }
  );
  emitSocialLog(input.logger, 'info', 'email.trigger', {
    organizationId: input.organizationId,
    trigger: 'digest',
  });
  return result;
};
