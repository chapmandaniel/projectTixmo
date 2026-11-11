import { assertSandboxGraphUrl } from './graph-guard';
import { readPollConfig, type PollConfig } from './polling';
import { DEFAULT_COMMENT_RETENTION_DAYS } from './retention';
import { loadKeyRing } from './token-crypto';

export interface SocialModuleConfig {
  enabled: boolean;
  ready: boolean;
  readyReason: string | null;
  sandboxOnly: true;
  phase: 'mock' | 'data';
  environment: 'sandbox';
  sandboxBaseUrl: string | null;
  alertFrom: string;
  emailCapture: boolean;
  poll: PollConfig;
  pollEnabled: boolean;
  retentionDays: number;
  teamAccessKeyPresent: boolean;
}

const retentionDays = (raw: string | undefined): number => {
  if (!raw?.trim()) return DEFAULT_COMMENT_RETENTION_DAYS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return DEFAULT_COMMENT_RETENTION_DAYS;
  return value;
};

export const isLabsEnvironment = (env: NodeJS.ProcessEnv): boolean =>
  (env.RAILWAY_ENVIRONMENT_NAME || '').trim().toLowerCase() === 'labs';

export const readSocialConfig = (env: NodeJS.ProcessEnv = process.env): SocialModuleConfig => {
  const enabled = env.SOCIAL_COMMAND_CENTER_ENABLED === 'true';
  let sandboxBaseUrl: string | null = null;
  let readyReason: string | null = null;
  if (env.SOCIAL_SANDBOX_BASE_URL?.trim()) {
    try {
      sandboxBaseUrl = assertSandboxGraphUrl(env.SOCIAL_SANDBOX_BASE_URL.trim()).origin;
    } catch {
      readyReason = 'sandbox-host';
    }
  } else if (enabled) {
    readyReason = 'sandbox-host';
  }
  let keyReady = false;
  if (env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim()) {
    try {
      loadKeyRing(env);
      keyReady = true;
    } catch {
      keyReady = false;
      readyReason = readyReason || 'encryption-key';
    }
  } else if (enabled) {
    readyReason = readyReason || 'encryption-key';
  }
  const ready = enabled && keyReady && sandboxBaseUrl !== null && readyReason === null;
  return {
    enabled,
    ready,
    readyReason: ready ? null : readyReason,
    sandboxOnly: true,
    phase: ready ? 'data' : 'mock',
    environment: 'sandbox',
    sandboxBaseUrl,
    alertFrom: env.SOCIAL_ALERT_EMAIL_FROM?.trim() || env.EMAIL_FROM?.trim() || '',
    emailCapture: env.SOCIAL_EMAIL_CAPTURE === 'true' || isLabsEnvironment(env),
    poll: readPollConfig(env),
    pollEnabled: env.SOCIAL_POLL_ENABLED === 'true',
    retentionDays: retentionDays(env.SOCIAL_COMMENT_RETENTION_DAYS),
    teamAccessKeyPresent: Boolean(env.SOCIAL_SANDBOX_TEAM_ACCESS_KEY?.trim()),
  };
};

/** Safe for the dashboard and for logs. No key, token, or team access key. */
export const toPublicSocialConfig = (config: SocialModuleConfig) => ({
  enabled: config.enabled,
  ready: config.ready,
  readyReason: config.readyReason,
  sandboxOnly: config.sandboxOnly,
  phase: config.phase,
  environment: config.environment,
  poll: config.poll,
  pollEnabled: config.pollEnabled,
  retentionDays: config.retentionDays,
  emailCapture: config.emailCapture,
});
