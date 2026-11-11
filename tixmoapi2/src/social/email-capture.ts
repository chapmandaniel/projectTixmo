import { randomBytes } from 'crypto';
import { ApiError } from '../utils/ApiError';
import type { RenderedSocialEmail } from './alert-email';
import { assertMetadataOnly } from './alert-email';

export interface CapturedSocialEmail extends RenderedSocialEmail {
  id: string;
  organizationId: string;
  capturedAt: string;
}

const captured: CapturedSocialEmail[] = [];

export const captureSocialEmail = (
  email: RenderedSocialEmail & { organizationId: string }
): CapturedSocialEmail => {
  assertMetadataOnly(email);
  const row: CapturedSocialEmail = {
    id: `cap_${randomBytes(8).toString('hex')}`,
    organizationId: email.organizationId,
    capturedAt: new Date().toISOString(),
    kind: email.kind,
    to: [...email.to],
    from: email.from,
    subject: email.subject,
    text: email.text,
    html: email.html,
    metadata: { ...email.metadata },
  };
  captured.push(row);
  return row;
};

export const listCapturedSocialEmails = (organizationId: string): CapturedSocialEmail[] =>
  captured.filter((row) => row.organizationId === organizationId);

export const clearCapturedSocialEmails = (): void => {
  captured.length = 0;
};

export const requireCaptureReader = (
  actor: { role?: string | null; organizationId?: string | null },
  enabled: boolean
): string => {
  if (!enabled) throw ApiError.notFound('Social Command Center is not enabled');
  if (!actor.organizationId || (actor.role !== 'OWNER' && actor.role !== 'ADMIN')) {
    throw ApiError.forbidden('Org admins can read captured social email');
  }
  return actor.organizationId;
};

export const socialMailShouldCapture = (env: NodeJS.ProcessEnv): boolean => {
  if (env.SOCIAL_EMAIL_CAPTURE === 'true') return true;
  return (env.RAILWAY_ENVIRONMENT_NAME || '').trim().toLowerCase() === 'labs';
};
