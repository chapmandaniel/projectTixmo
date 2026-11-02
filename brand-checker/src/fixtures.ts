import { readFileSync } from 'node:fs';
import type { HttpClient, HttpRequest, HttpResponse } from './types.js';

const fixtureDir = new URL('../fixtures/', import.meta.url);

export const readFixtureSample = (name: string): string => {
  try {
    return readFileSync(new URL(name, fixtureDir), 'utf8');
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'ENOENT') {
      throw new Error(
        `--fixtures sample files are not available (${name}). This build does not include fixtures.`
      );
    }
    throw error;
  }
};

const read = (name: string): string => readFixtureSample(name);

const json = (body: string, url: string, status = 200): HttpResponse => ({ status, url, body });

const html = (name: string, url: string, status = 200): HttpResponse => ({
  status,
  url,
  body: read(name),
});

/**
 * Bundled public responses for offline runs. This client never opens a network
 * connection. Unknown hosts throw so a fixtures run cannot wander onto the internet.
 */
export const createFixtureClient = (): HttpClient => ({
  async request(url: string, _init?: HttpRequest): Promise<HttpResponse> {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'api.twitter.com' && parsed.pathname === '/2/users/by') {
      return json(read('x-users.json'), url);
    }
    if (host === 'api.twitter.com' && parsed.pathname === '/2/tweets/search/recent') {
      return json(read('x-search.json'), url);
    }
    if (host === 'www.reddit.com' && parsed.pathname === '/api/v1/access_token') {
      return json(JSON.stringify({ access_token: 'fixture-reddit-token', token_type: 'bearer' }), url);
    }
    if (host === 'oauth.reddit.com' && parsed.pathname === '/search') {
      const type = parsed.searchParams.get('type');
      return json(read(type === 'user' ? 'reddit-users.json' : 'reddit-links.json'), url);
    }
    if (host === 'oauth.reddit.com' && parsed.pathname.startsWith('/user/')) {
      return json(JSON.stringify({ data: { subreddit: { public_description: '', title: '' } } }), url);
    }
    if (host === 'www.facebook.com' || host === 'facebook.com') {
      const handle = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
      if (handle === 'harbourfesttickets') return html('facebook-harbourfesttickets.html', url);
      return json('<html><title>Page not found</title><body>Page not found</body></html>', url, 404);
    }
    if (host === 'www.instagram.com' || host === 'instagram.com') {
      const handle = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
      if (handle === 'harbourfest_prizes') return html('instagram-harbourfest-prizes.html', url);
      return json('<html><title>Page not found</title><body>Page not found</body></html>', url, 404);
    }
    if (host === 'crt.sh') return json(read('crtsh.json'), url);
    throw new Error(`fixture client refuses unexpected host ${host}`);
  },
});
