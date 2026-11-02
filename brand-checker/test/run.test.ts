import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createFixtureClient } from '../src/fixtures.js';
import { runChecker } from '../src/run.js';
import type { HttpClient, Logger } from '../src/types.js';
import { demoOrg } from './helpers.js';

const secretPhone = '+17095550199';
const secretEmail = 'prizes@scam.example';
const token = 'gwc_localtokenvalue123456';

const writeWatchlist = (dir: string): string => {
  const path = join(dir, 'watchlist.json');
  writeFileSync(path, JSON.stringify({ organizations: [demoOrg()] }));
  return path;
};

describe('fixtures run', () => {
  it('ingests every category from bundled pages and does not log contact details', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brand-run-'));
    const lines: string[] = [];
    const logger: Logger = {
      info(message) {
        lines.push(message);
      },
      alert(message) {
        lines.push(message);
      },
    };
    const posts: { url: string; body: string }[] = [];
    const apiHttp: HttpClient = {
      async request(url, init) {
        posts.push({ url, body: init?.body ?? '' });
        return { status: 200, url, body: '{"success":true}' };
      },
    };
    const config = loadConfig(['--fixtures'], {
      TIXMO_API_URL: 'http://127.0.0.1:3000',
      TIXMO_CHECKER_TOKEN: token,
      TIXMO_WATCHLIST_PATH: writeWatchlist(dir),
      CRTSH_CACHE_PATH: join(dir, 'crtsh.json'),
      BRAND_CHECKER_REPORT: join(dir, 'last-run.json'),
      CHECKER_CONTACT_URL: 'http://127.0.0.1:5173/brand-protection',
    });
    const summary = await runChecker({
      config,
      sourceHttp: createFixtureClient(),
      apiHttp,
      logger,
      now: new Date('2026-11-02T12:00:00.000Z'),
    });
    assert.equal(summary.ok, true);
    assert.equal(summary.verifications, 0);
    const matchCall = posts.find((post) => post.url.endsWith('/ingest/matches'));
    assert.ok(matchCall);
    const matches = (JSON.parse(matchCall.body) as { matches: { category: string; sourceUrl: string }[] }).matches;
    const categories = new Set(matches.map((match) => match.category));
    assert.deepEqual(
      [...categories].sort(),
      ['FAKE_CONTEST', 'FALSE_ASSOCIATION', 'IMPERSONATION_PROFILE', 'LOOKALIKE_DOMAIN']
    );
    assert.equal(matches.some((match) => match.sourceUrl.includes('/status/77')), false);
    assert.equal(matches.some((match) => match.sourceUrl.includes('kijiji')), false);
    assert.equal(summary.platforms.every((platform) => platform.state === 'OK'), true);
    const logged = lines.join('\n');
    assert.equal(logged.includes(secretPhone), false);
    assert.equal(logged.includes(secretEmail), false);
    assert.equal(logged.includes(token), false);
    assert.equal(posts.length, 6);
  });

  it('stops the run on a Tixmo API 401 and does not submit matches', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brand-run-'));
    const lines: string[] = [];
    const urls: string[] = [];
    const apiHttp: HttpClient = {
      async request(url) {
        urls.push(url);
        return { status: 401, url, body: '' };
      },
    };
    const config = loadConfig(['--fixtures'], {
      TIXMO_API_URL: 'http://127.0.0.1:3000',
      TIXMO_CHECKER_TOKEN: token,
      TIXMO_WATCHLIST_PATH: writeWatchlist(dir),
      CRTSH_CACHE_PATH: join(dir, 'crtsh.json'),
      BRAND_CHECKER_REPORT: join(dir, 'last-run.json'),
    });
    const summary = await runChecker({
      config,
      sourceHttp: createFixtureClient(),
      apiHttp,
      logger: {
        info(message) {
          lines.push(message);
        },
        alert(message) {
          lines.push(message);
        },
      },
      now: new Date('2026-11-02T12:00:00.000Z'),
    });
    assert.equal(summary.ok, false);
    assert.equal(summary.status, 401);
    assert.equal(urls.length, 1);
    assert.equal(urls[0].endsWith('/ingest/matches'), false);
    assert.match(lines.join('\n'), /ALERT brand-checker: Tixmo API returned 401/);
    assert.equal(lines.join('\n').includes(token), false);
  });
});
