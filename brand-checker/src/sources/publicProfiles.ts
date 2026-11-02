import { classifySocial } from '../classify.js';
import { detectPageStop } from '../publicPage.js';
import { brandSlugs } from '../watchlist.js';
import { Pace } from '../pace.js';
import { isRejectedSource } from '../text.js';
import type { HttpClient, OrganizationTarget, SocialPlatform, SourceResult } from '../types.js';

const decode = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const meta = (html: string, key: string): string => {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${key}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decode(match[1]);
  }
  return '';
};

const pageTitle = (html: string): string => {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decode(match[1]).replace(/\s+[|•].*$/, '').trim() : '';
};

const numericId = (html: string): string => {
  const match = html.match(/"(?:userID|profile_id|owner_id)"\s*:\s*"(\d{3,})"/);
  return match?.[1] ?? '';
};

export const profileUrls = (platform: SocialPlatform, orgs: OrganizationTarget[]): string[] => {
  const urls: string[] = [];
  for (const org of orgs) {
    for (const slug of brandSlugs(org)) {
      if (platform === 'FACEBOOK') {
        urls.push(`https://www.facebook.com/${slug}`);
        urls.push(`https://www.facebook.com/${slug}tickets`);
      } else if (platform === 'INSTAGRAM') {
        urls.push(`https://www.instagram.com/${slug}/`);
        urls.push(`https://www.instagram.com/${slug}_prizes/`);
      }
    }
  }
  return [...new Set(urls)].filter((url) => !isRejectedSource(url)).slice(0, 8);
};

export const collectPublicProfiles = async (
  platform: 'FACEBOOK' | 'INSTAGRAM',
  orgs: OrganizationTarget[],
  http: HttpClient,
  pace: Pace,
  userAgent: string,
  now = new Date()
): Promise<SourceResult> => {
  const findings = [];
  for (const url of profileUrls(platform, orgs)) {
    await pace.wait();
    const response = await http.request(url, {
      headers: { 'User-Agent': userAgent, Accept: 'text/html' },
    });
    const stop = detectPageStop(response);
    if (stop) return { findings, verifications: [], stop };
    if (response.status >= 400) continue;
    const html = response.body;
    const title = meta(html, 'og:title') || pageTitle(html);
    const description = meta(html, 'og:description');
    const handle = new URL(response.url || url).pathname.split('/').filter(Boolean)[0] ?? '';
    const accountId = numericId(html);
    for (const org of orgs) {
      const finding = classifySocial(
        org,
        {
          platform,
          sourceUrl: (response.url || url).replace(/\/$/, ''),
          platformAccountId: accountId || undefined,
          accountHandle: handle,
          suspectDisplayName: title,
          text: `${title}\n${description}`,
        },
        now
      );
      if (finding && !isRejectedSource(finding.sourceUrl)) findings.push(finding);
    }
  }
  return { findings, verifications: [] };
};
