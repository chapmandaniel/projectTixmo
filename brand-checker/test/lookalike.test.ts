import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createFileCache } from '../src/net.js';
import { assertOfficialSearchApi, collectLookalikes } from '../src/sources/lookalike.js';
import { demoOrg, page, trackingClient } from './helpers.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const crtBody = readFileSync(fileURLToPath(new URL('../fixtures/crtsh.json', import.meta.url)), 'utf8');

describe('lookalike domains', () => {
  it('records the hostname only and skips official, wildcard, and marketplace names', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crtsh-'));
    const tracked = trackingClient((url) => page(url, 200, crtBody));
    const result = await collectLookalikes(
      [demoOrg()],
      tracked.client,
      createFileCache(join(dir, 'cache.json'), () => Date.parse('2026-11-02T12:00:00.000Z')),
      'TixmoBrandChecker/1.0 (+http://127.0.0.1/contact)',
      async () => undefined,
      undefined,
      undefined,
      new Date('2026-11-02T12:00:00.000Z')
    );
    assert.equal(result.stop, undefined);
    assert.deepEqual(
      result.findings.map((finding) => finding.sourceUrl),
      ['harbourfest-tickets.example']
    );
    const finding = result.findings[0];
    assert.equal(finding.platform, 'LOOKALIKE_DOMAIN');
    assert.equal(finding.category, 'LOOKALIKE_DOMAIN');
    assert.equal(finding.matchedText, undefined);
    assert.equal(finding.accountHandle, undefined);
    assert.equal(finding.evidenceEmails, undefined);
    assert.equal(finding.evidencePhones, undefined);
    assert.equal(tracked.urls.length, 1);
    assert.equal(tracked.urls[0].startsWith('https://crt.sh/'), true);
  });

  it('stops on crt.sh HTTP 429 or 403 without retrying', async () => {
    for (const status of [429, 403]) {
      const dir = mkdtempSync(join(tmpdir(), 'crtsh-'));
      const delays: number[] = [];
      const tracked = trackingClient((url) => page(url, status, ''));
      const result = await collectLookalikes(
        [demoOrg()],
        tracked.client,
        createFileCache(join(dir, 'cache.json'), () => Date.parse('2026-11-02T12:00:00.000Z')),
        'TixmoBrandChecker/1.0',
        async (ms) => {
          delays.push(ms);
        },
        undefined,
        undefined,
        new Date('2026-11-02T12:00:00.000Z')
      );
      assert.equal(result.stop?.state, 'BLOCKED');
      assert.equal(result.stop?.detail, `crt.sh http ${status}`);
      assert.equal(tracked.urls.length, 1);
      assert.deepEqual(delays, []);
    }
  });

  it('retries crt.sh only after a 5xx response', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crtsh-'));
    const delays: number[] = [];
    let calls = 0;
    const tracked = trackingClient((url) => {
      calls += 1;
      if (calls === 1) return page(url, 503, '');
      return page(url, 200, crtBody);
    });
    const result = await collectLookalikes(
      [demoOrg()],
      tracked.client,
      createFileCache(join(dir, 'cache.json'), () => Date.parse('2026-11-02T12:00:00.000Z')),
      'TixmoBrandChecker/1.0',
      async (ms) => {
        delays.push(ms);
      },
      undefined,
      undefined,
      new Date('2026-11-02T12:00:00.000Z')
    );
    assert.equal(result.stop, undefined);
    assert.deepEqual(delays, [1000]);
    assert.equal(result.findings[0]?.sourceUrl, 'harbourfest-tickets.example');
  });

  it('skips a search-api domain that is not a URL', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crtsh-'));
    const tracked = trackingClient((url) => {
      if (new URL(url).hostname === 'crt.sh') return page(url, 200, '[]');
      return page(url, 200, JSON.stringify({ domains: ['https://%', 'harbourfest-win.example'] }));
    });
    const result = await collectLookalikes(
      [demoOrg()],
      tracked.client,
      createFileCache(join(dir, 'cache.json'), () => Date.parse('2026-11-02T12:00:00.000Z')),
      'TixmoBrandChecker/1.0',
      async () => undefined,
      'https://lookalike-api.example.test/domains',
      undefined,
      new Date('2026-11-02T12:00:00.000Z')
    );
    assert.deepEqual(
      result.findings.map((finding) => finding.sourceUrl),
      ['harbourfest-win.example']
    );
  });

  it('refuses search-engine hosts and can read an official search API', async () => {
    assert.throws(() => assertOfficialSearchApi('https://www.google.com/search?q=harbourfest'), /search engine/);
    const dir = mkdtempSync(join(tmpdir(), 'crtsh-'));
    const tracked = trackingClient((url) => {
      if (new URL(url).hostname === 'crt.sh') return page(url, 200, '[]');
      return page(url, 200, JSON.stringify({ domains: ['harbourfest-win.example'] }));
    });
    const result = await collectLookalikes(
      [demoOrg()],
      tracked.client,
      createFileCache(join(dir, 'cache.json'), () => Date.parse('2026-11-02T12:00:00.000Z')),
      'TixmoBrandChecker/1.0',
      async () => undefined,
      'https://lookalike-api.example.test/domains',
      'search-key',
      new Date('2026-11-02T12:00:00.000Z')
    );
    assert.deepEqual(
      result.findings.map((finding) => finding.sourceUrl),
      ['harbourfest-win.example']
    );
    assert.equal(result.findings[0].matchedRule, 'lookalike-search-api');
    assert.equal(tracked.urls.some((url) => url.includes('google')), false);
  });
});
