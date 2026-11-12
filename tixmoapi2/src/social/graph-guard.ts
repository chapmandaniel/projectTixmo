import { SocialTokenError } from './token-crypto';

/** Real Graph hosts are refused even if a caller tries to add them. */
export const DENIED_GRAPH_HOSTS = new Set([
  'graph.facebook.com',
  'graph.instagram.com',
  'facebook.com',
  'instagram.com',
  'www.facebook.com',
  'www.instagram.com',
]);

export const SANDBOX_GRAPH_HOSTS = new Set(['meta-graph-sandbox-production.up.railway.app']);

const deniedHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  if (DENIED_GRAPH_HOSTS.has(host)) return true;
  return (
    host.endsWith('.facebook.com') || host.endsWith('.instagram.com') || host.endsWith('.fbcdn.net')
  );
};

export const assertSandboxGraphUrl = (
  raw: string,
  allowlist: ReadonlySet<string> = SANDBOX_GRAPH_HOSTS
): URL => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SocialTokenError('Social Graph URL is not allowed.');
  }
  if (url.protocol !== 'https:') throw new SocialTokenError('Social Graph URL is not allowed.');
  if (url.username || url.password) throw new SocialTokenError('Social Graph URL is not allowed.');
  const host = url.hostname.toLowerCase();
  if (deniedHost(host) || !allowlist.has(host)) {
    throw new SocialTokenError('Social Graph host is not allowlisted.');
  }
  return url;
};

/** Builds the request description and does not open a socket. */
export const planSandboxGraphRequest = (
  raw: string
): { href: string; host: string; sandbox: true } => {
  const url = assertSandboxGraphUrl(raw);
  return { href: url.href, host: url.hostname.toLowerCase(), sandbox: true };
};
