import { classifySocial, verificationFromOfficialText } from '../classify.js';
import { readJson } from '../http.js';
import { isRejectedSource } from '../text.js';
import type { Finding, HttpClient, OrganizationTarget, SourceResult, Verification } from '../types.js';
import { brandSlugs } from '../watchlist.js';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

export const xUsernames = (org: OrganizationTarget): string[] => {
  const names = new Set<string>();
  for (const slug of brandSlugs(org)) {
    const base = slug.replace(/[^a-z0-9_]/g, '').slice(0, 15);
    if (base.length < 3) continue;
    names.add(base);
    for (const suffix of ['_gw', '_win']) {
      const candidate = `${base}${suffix}`;
      if (candidate.length <= 15) names.add(candidate);
    }
  }
  return [...names].slice(0, 10);
};

const dedupe = (findings: Finding[]): Finding[] => {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.organizationId}:${finding.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const collectX = async (
  orgs: OrganizationTarget[],
  http: HttpClient,
  bearerToken: string | undefined,
  now = new Date(),
  userAgent = 'TixmoBrandChecker/1.0 (+https://example.com/contact)'
): Promise<SourceResult> => {
  if (!bearerToken) return { findings: [], verifications: [], skipped: true };
  const headers = { Authorization: `Bearer ${bearerToken}`, 'User-Agent': userAgent };
  const findings: Finding[] = [];
  const verifications: Verification[] = [];
  const usernames = [...new Set(orgs.flatMap(xUsernames))].slice(0, 20);
  if (usernames.length) {
    const url = `https://api.twitter.com/2/users/by?usernames=${encodeURIComponent(usernames.join(','))}&user.fields=username,name,description`;
    const response = await http.request(url, { headers });
    if (response.status >= 400) {
      return { findings: [], verifications: [], stop: { state: 'BLOCKED', detail: `http ${response.status}` } };
    }
    const body = asRecord(readJson(response.body));
    const users = Array.isArray(body?.data) ? body.data : [];
    for (const raw of users) {
      const user = asRecord(raw);
      if (!user) continue;
      const id = asString(user.id);
      const username = asString(user.username);
      const name = asString(user.name);
      const description = asString(user.description);
      if (!id || !username) continue;
      const sourceUrl = `https://x.com/${username}`;
      if (isRejectedSource(sourceUrl)) continue;
      for (const org of orgs) {
        const official = org.accounts.find(
          (account) => account.platform === 'X' && account.platformAccountId === id
        );
        if (official) {
          const code = verificationFromOfficialText('X', id, `${description}\n${name}`);
          if (code) verifications.push(code);
          continue;
        }
        const finding = classifySocial(
          org,
          {
            platform: 'X',
            sourceUrl,
            platformAccountId: id,
            accountHandle: username,
            suspectDisplayName: name,
            text: `${name}\n${description}`,
          },
          now
        );
        if (finding) findings.push(finding);
      }
    }
  }
  for (const org of orgs) {
    const terms = org.names.map((name) => `"${name.replace(/"/g, '')}"`).join(' OR ');
    if (!terms) continue;
    const query = `(${terms}) (giveaway OR contest OR "free tickets" OR "official account")`;
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=author_id,created_at,text&expansions=author_id&user.fields=username,name`;
    const response = await http.request(url, { headers });
    if (response.status >= 400) {
      return {
        findings: dedupe(findings),
        verifications,
        stop: { state: 'BLOCKED', detail: `http ${response.status}` },
      };
    }
    const body = asRecord(readJson(response.body));
    const tweets = Array.isArray(body?.data) ? body.data : [];
    const includes = asRecord(body?.includes);
    const included = Array.isArray(includes?.users) ? includes.users : [];
    const users = new Map<string, { username: string; name: string }>();
    for (const raw of included) {
      const user = asRecord(raw);
      if (!user) continue;
      users.set(asString(user.id), { username: asString(user.username), name: asString(user.name) });
    }
    for (const raw of tweets) {
      const tweet = asRecord(raw);
      if (!tweet) continue;
      const id = asString(tweet.id);
      const authorId = asString(tweet.author_id);
      const text = asString(tweet.text);
      const author = users.get(authorId);
      const username = author?.username || 'i';
      const sourceUrl = `https://x.com/${username}/status/${id}`;
      if (!id || isRejectedSource(sourceUrl)) continue;
      const finding = classifySocial(
        org,
        {
          platform: 'X',
          sourceUrl,
          platformAccountId: authorId || undefined,
          accountHandle: author?.username,
          suspectDisplayName: author?.name,
          text,
          detectedAt: asString(tweet.created_at) || undefined,
        },
        now
      );
      if (finding) findings.push(finding);
    }
  }
  return { findings: dedupe(findings), verifications };
};
