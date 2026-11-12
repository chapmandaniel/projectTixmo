import {
  assertMetadataOnly,
  buildDigestEmail,
  buildHighAlertEmail,
  type DigestInput,
  type HighAlertInput,
  type RenderedSocialEmail,
} from './alert-email';
import { captureSocialEmail, socialMailShouldCapture } from './email-capture';

export interface SocialMailLogger {
  info?(message: string): void;
  warn?(message: string): void;
}

export interface SocialMailSend {
  (email: RenderedSocialEmail): Promise<{ messageId?: string } | void>;
}

const logLine = (organizationId: string, kind: string, outcome: string): string =>
  `Social email ${outcome} organization=${organizationId} kind=${kind}`;

const deliverRendered = async (
  rendered: RenderedSocialEmail,
  organizationId: string,
  env: NodeJS.ProcessEnv,
  send: SocialMailSend | undefined,
  logger: SocialMailLogger | undefined
): Promise<{ status: 'captured' | 'sent' | 'unsent'; id?: string }> => {
  assertMetadataOnly(rendered);
  if (socialMailShouldCapture(env)) {
    const row = captureSocialEmail({ ...rendered, organizationId });
    logger?.info?.(logLine(organizationId, rendered.kind, 'captured'));
    return { status: 'captured', id: row.id };
  }
  try {
    const transport = send || (await defaultTransport());
    await transport(rendered);
    return { status: 'sent' };
  } catch {
    logger?.warn?.(logLine(organizationId, rendered.kind, 'unsent'));
    return { status: 'unsent' };
  }
};

const defaultTransport = async (): Promise<SocialMailSend> => {
  const email = await import('../config/email');
  return (rendered) =>
    email.transporter.sendMail({
      from: rendered.from || undefined,
      to: rendered.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
};

export const deliverHighAlert = (
  input: HighAlertInput,
  env: NodeJS.ProcessEnv,
  options: { send?: SocialMailSend; logger?: SocialMailLogger } = {}
): Promise<{ status: 'captured' | 'sent' | 'unsent'; id?: string }> =>
  deliverRendered(
    buildHighAlertEmail(input),
    input.organizationId,
    env,
    options.send,
    options.logger
  );

export const deliverDigest = (
  input: DigestInput,
  env: NodeJS.ProcessEnv,
  options: { send?: SocialMailSend; logger?: SocialMailLogger } = {}
): Promise<{ status: 'captured' | 'sent' | 'unsent'; id?: string }> =>
  deliverRendered(buildDigestEmail(input), input.organizationId, env, options.send, options.logger);
