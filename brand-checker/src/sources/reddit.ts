import { classifySocial, verificationFromOfficialText } from '../classify.js';
import { readJson } from '../http.js';
import { isRejectedSource } from '../text.js';
import type { Finding, HttpClient, OrganizationTarget, SourceResult, Verification } from '../types.js';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export const redditUserAgent = (contactUrl: string, redditContact?: string): string => {
  const raw = (redditContact || contactUrl).replace(/[\r\n()]/g, '').trim();
  if (!raw || raw.includes('://')) return `tixmo:brand-checker:1.0 (+${raw || 'https://example.com/contact'})`;
  const by = raw.startsWith('/u/') ? raw : `/u/${raw.replace(/^@/, '')}`;
  return `tixmo:brand-checker:1.0 (by ${by})`;
};

export const collectReddit = async (
  orgs: OrganizationTarget[],
  http: HttpClient,
  clientId: string | undefined,
  clientSecret: string | undefined,
  now = new Date(),
  userAgent = redditUserAgent('https://example.com/contact')
): Promise<SourceResult> => {
  if (!clientId || !clientSecret) return { findings: [], verifications: [], skipped: true };
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenResponse = await http.request('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: 'grant_type=client_credentials',
  });
  if (tokenResponse.status >= 400) {
    return { findings: [], verifications: [], stop: { state: 'BLOCKED', detail: `http ${tokenResponse.status}` } };
  }
  const tokenBody = asRecord(readJson(tokenResponse.body));
  const accessToken = asString(tokenBody?.access_token);
  if (!accessToken) {
    return { findings: [], verifications: [], stop: { state: 'BLOCKED', detail: 'reddit token missing' } };
  }
  const headers = { Authorization: `Bearer ${accessToken}`, 'User-Agent': userAgent };
  const findings: Finding[] = [];
  const verifications: Verification[] = [];
  for (const org of orgs) {
    for (const account of org.accounts.filter((item) => item.platform === 'REDDIT')) {
      const about = await http.request(
        `https://oauth.reddit.com/user/${encodeURIComponent(account.handle)}/about`,
        { headers }
      );
      if (about.status >= 400) {
        return { findings, verifications, stop: { state: 'BLOCKED', detail: `http ${about.status}` } };
      }
      const data = asRecord(asRecord(readJson(about.body))?.data);
      const subreddit = asRecord(data?.subreddit);
      const text = `${asString(subreddit?.public_description)}\n${asString(subreddit?.title)}`;
      const code = verificationFromOfficialText('REDDIT', account.platformAccountId, text);
      if (code) verifications.push(code);
    }
    const query = org.names.map((name) => `"${name.replace(/"/g, '')}"`).join(' OR ');
    if (!query) continue;
    for (const type of ['link', 'user'] as const) {
      const url = `https://oauth.reddit.com/search?q=${encodeURIComponent(query)}&type=${type}&limit=10`;
      const response = await http.request(url, { headers });
      if (response.status >= 400) {
        return { findings, verifications, stop: { state: 'BLOCKED', detail: `http ${response.status}` } };
      }
      const children = asRecord(asRecord(readJson(response.body))?.data)?.children;
      if (!Array.isArray(children)) continue;
      for (const raw of children) {
        const child = asRecord(raw);
        const data = asRecord(child?.data);
        if (!data) continue;
        if (type === 'user') {
          const id = asString(data.id);
          const name = asString(data.name);
          const subreddit = asRecord(data.subreddit);
          const text = `${asString(subreddit?.public_description)}\n${asString(subreddit?.title)}\n${name}`;
          const sourceUrl = `https://reddit.com/user/${name}`;
          if (!name || isRejectedSource(sourceUrl)) continue;
          const finding = classifySocial(
            org,
            {
              platform: 'REDDIT',
              sourceUrl,
              platformAccountId: id || undefined,
              accountHandle: name,
              suspectDisplayName: asString(subreddit?.title) || name,
              text,
            },
            now
          );
          if (finding) findings.push(finding);
          continue;
        }
        const permalink = asString(data.permalink);
        if (!permalink.startsWith('/')) continue;
        const sourceUrl = `https://reddit.com${permalink.replace(/\/$/, '')}`;
        if (isRejectedSource(sourceUrl)) continue;
        const author = asString(data.author);
        const text = `${asString(data.title)}\n${asString(data.selftext)}`;
        const created = typeof data.created_utc === 'number' ? new Date(data.created_utc * 1000).toISOString() : undefined;
        const finding = classifySocial(
          org,
          {
            platform: 'REDDIT',
            sourceUrl,
            platformAccountId: asString(data.author_fullname).replace(/^t2_/, '') || undefined,
            accountHandle: author || undefined,
            suspectDisplayName: author || undefined,
            text,
            detectedAt: created,
          },
          now
        );
        if (finding) findings.push(finding);
      }
    }
  }
  return { findings, verifications };
};
