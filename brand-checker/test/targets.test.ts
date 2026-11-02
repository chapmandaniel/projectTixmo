import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createFixtureClient } from '../src/fixtures.js';
import { TargetsForbidden } from '../src/ingest.js';
import { runChecker } from '../src/run.js';
import { watchlistFromTargets } from '../src/targets.js';
import type { HttpClient, Logger } from '../src/types.js';

const token = 'gwc_localtokenvalue123456';
const orgId = '11111111-1111-4111-8111-111111111111';

const quiet = (): Logger => ({
  info() {},
  alert() {},
});

const writeWatchlist = (dir: string, accountId: string): string => {
  const path = join(dir, 'watchlist.json');
  writeFileSync(
    path,
    JSON.stringify({
      organizations: [
        {
          organizationId: orgId,
          names: ['Harbour Fest'],
          domains: ['harbourfest.example'],
          accounts: [
            {
              platform: 'X',
              platformAccountId: accountId,
              handle: 'harbourfest_gw',
            },
          ],
        },
      ],
    })
  );
  return path;
};

describe('verified targets', () => {
  it('keeps API account ids and file names', () => {
    const watchlist = watchlistFromTargets(
      [
        {
          organizationId: orgId,
          platform: 'X',
          platformAccountId: '1000000001',
          handle: 'harbourfest',
        },
      ],
      {
        organizations: [
          {
            organizationId: orgId,
            names: ['Harbour Fest'],
            domains: ['harbourfest.example'],
            accounts: [
              {
                platform: 'X',
                platformAccountId: '999000111',
                handle: 'harbourfest_gw',
              },
            ],
          },
        ],
      }
    );
    assert.equal(watchlist.organizations[0].accounts[0].platformAccountId, '1000000001');
    assert.deepEqual(watchlist.organizations[0].names, ['Harbour Fest']);
    assert.deepEqual(watchlist.organizations[0].domains, ['harbourfest.example']);
  });

  it('uses the watchlist file in fixtures mode and does not call targets', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'targets-fixtures-'));
    const urls: string[] = [];
    const apiHttp: HttpClient = {
      async request(url) {
        urls.push(url);
        return { status: 200, url, body: '{"success":true}' };
      },
    };
    const config = loadConfig(['--fixtures'], {
      TIXMO_API_URL: 'http://127.0.0.1:3000',
      TIXMO_CHECKER_TOKEN: token,
      TIXMO_WATCHLIST_PATH: writeWatchlist(dir, '1000000001'),
      CRTSH_CACHE_PATH: join(dir, 'crtsh.json'),
      BRAND_CHECKER_REPORT: join(dir, 'last-run.json'),
    });
    const summary = await runChecker({
      config,
      sourceHttp: createFixtureClient(),
      apiHttp,
      logger: quiet(),
      now: new Date('2026-11-02T12:00:00.000Z'),
    });
    assert.equal(summary.ok, true);
    assert.equal(urls.some((url) => url.includes('/ingest/targets')), false);
  });

  it('falls back to the watchlist when the token lacks targets:read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'targets-fallback-'));
    const urls: string[] = [];
    const apiHttp: HttpClient = {
      async request(url) {
        urls.push(url);
        if (url.includes('/ingest/targets')) return { status: 403, url, body: '' };
        return { status: 200, url, body: '{"success":true}' };
      },
    };
    const config = loadConfig([], {
      TIXMO_API_URL: 'http://127.0.0.1:3000',
      TIXMO_CHECKER_TOKEN: token,
      TIXMO_WATCHLIST_PATH: writeWatchlist(dir, '1000000001'),
      CHECKER_CONTACT_URL: 'http://127.0.0.1:5173/brand-protection',
      PUBLIC_PAGE_INTERVAL_MS: '0',
      CRTSH_CACHE_PATH: join(dir, 'crtsh.json'),
      BRAND_CHECKER_REPORT: join(dir, 'last-run.json'),
    });
    const summary = await runChecker({
      config,
      sourceHttp: createFixtureClient(),
      apiHttp,
      logger: quiet(),
      now: new Date('2026-11-02T12:00:00.000Z'),
    });
    assert.equal(summary.ok, true);
    assert.equal(urls[0].includes('/ingest/targets'), true);
    assert.ok(TargetsForbidden);
  });

  it('stops the run when the targets route returns 401', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'targets-stop-'));
    const urls: string[] = [];
    const lines: string[] = [];
    const apiHttp: HttpClient = {
      async request(url) {
        urls.push(url);
        return { status: 401, url, body: '' };
      },
    };
    const config = loadConfig([], {
      TIXMO_API_URL: 'http://127.0.0.1:3000',
      TIXMO_CHECKER_TOKEN: token,
      TIXMO_WATCHLIST_PATH: writeWatchlist(dir, '1000000001'),
      CHECKER_CONTACT_URL: 'http://127.0.0.1:5173/brand-protection',
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
    assert.match(lines.join('\n'), /returned 401/);
  });
});
