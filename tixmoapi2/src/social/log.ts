/** Structured social logs. Never include tokens, ciphertext, comment text, or handles. */

export type SocialLogLevel = 'info' | 'warn' | 'error';

export interface SocialLogFields {
  organizationId?: string;
  connectionId?: string;
  syncRunId?: string;
  route?: string;
  host?: string;
  path?: string;
  method?: string;
  status?: number;
  errorCode?: string;
  postsFetched?: number;
  commentsFetched?: number;
  queryModel?: string;
  queryAction?: string;
  trigger?: string;
  running?: boolean;
  intervalMs?: number;
}

const FORBIDDEN =
  /token|ciphertext|authorization|password|secret|comment|handle|caption|body|message/i;

export const socialLogLine = (
  event: string,
  fields: SocialLogFields = {}
): Record<string, string | number | boolean | undefined> => {
  const out: Record<string, string | number | boolean | undefined> = { event: `social.${event}` };
  for (const key of Object.keys(fields) as (keyof SocialLogFields)[]) {
    const value = fields[key];
    if (value === undefined || value === null) continue;
    if (FORBIDDEN.test(String(key))) continue;
    if (
      typeof value === 'string' &&
      FORBIDDEN.test(value) &&
      key !== 'errorCode' &&
      key !== 'path'
    ) {
      continue;
    }
    out[String(key)] = value;
  }
  return out;
};

export interface SocialLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export const emitSocialLog = (
  logger: SocialLogger | undefined,
  level: SocialLogLevel,
  event: string,
  fields?: SocialLogFields
): void => {
  const line = socialLogLine(event, fields);
  const message = String(line.event);
  if (!logger) return;
  if (level === 'error') logger.error(message, line);
  else if (level === 'warn') logger.warn(message, line);
  else logger.info(message, line);
};
