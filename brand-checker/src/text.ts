const CHECKER_TOKEN = /\bgwc_[A-Za-z0-9_-]{8,}\b/g;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?:\+\d[\d\s().-]{6,}\d|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b)/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const SECRET_ASSIGNMENT =
  /\b(?:X_BEARER_TOKEN|REDDIT_CLIENT_SECRET|REDDIT_CLIENT_ID|LOOKALIKE_SEARCH_API_KEY|TIXMO_CHECKER_TOKEN)\s*[=:]\s*\S+/gi;

/** Remove checker tokens, contact details, and header secrets from log text. */
export const redact = (value: string): string =>
  value
    .replace(CHECKER_TOKEN, 'gwc_[redacted]')
    .replace(BEARER, 'Bearer [redacted]')
    .replace(SECRET_ASSIGNMENT, (match) => match.replace(/[=:]\s*\S+/, '= [redacted]'))
    .replace(EMAIL, '[redacted-email]')
    .replace(PHONE, '[redacted-phone]');

export const cleanText = (value: string, max: number): string => {
  let cleaned = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const control = code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31);
    if (!control) cleaned += value[index];
  }
  const trimmed = cleaned.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

export const normalizeSpaces = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const compact = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

export const safeDetectedAt = (raw: string | undefined, now = new Date()): string => {
  if (!raw) return now.toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return now.toISOString();
  if (parsed.getTime() > now.getTime()) return now.toISOString();
  return parsed.toISOString();
};

const EMAIL_FIND = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_FIND = /(?:\+\d{8,15}|\+\d{1,3}[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b)/g;

export const extractEvidence = (
  text: string
): { evidencePhones?: string[]; evidenceEmails?: string[] } => {
  const emails = [...new Set((text.match(EMAIL_FIND) ?? []).map((item) => item.slice(0, 120)))].slice(
    0,
    5
  );
  const phones = [
    ...new Set(
      (text.match(PHONE_FIND) ?? [])
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter((item) => item.length >= 3 && item.length <= 40)
    ),
  ].slice(0, 5);
  return {
    ...(phones.length ? { evidencePhones: phones } : {}),
    ...(emails.length ? { evidenceEmails: emails } : {}),
  };
};

export const isLoopbackHost = (hostname: string): boolean => {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
};

const MARKETPLACE_HOST = (host: string): boolean => {
  if (host === 'kijiji.ca' || host.endsWith('.kijiji.ca')) return true;
  if (host.includes('craigslist.')) return true;
  return false;
};

/** Drop marketplace and resale URLs. This checker does not monitor those sites. */
export const isRejectedSource = (sourceUrl: string): boolean => {
  const raw = sourceUrl.trim();
  if (!raw || raw.length > 500) return true;
  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return true;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (MARKETPLACE_HOST(host)) return true;
  if (
    (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com') &&
    url.pathname.toLowerCase().includes('/marketplace')
  ) {
    return true;
  }
  return false;
};
