import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFixtureClient } from '../src/fixtures.js';
import { collectX } from '../src/sources/x.js';
import { demoOrg, page, trackingClient } from './helpers.js';

describe('X', () => {
  it('reads the official API fixtures and skips the official account', async () => {
    const result = await collectX([demoOrg()], createFixtureClient(), 'fixture-bearer', new Date('2026-11-02T12:00:00.000Z'));
    assert.equal(result.stop, undefined);
    const urls = result.findings.map((finding) => finding.sourceUrl);
    assert.ok(urls.includes('https://x.com/harbourfest_gw'));
    assert.ok(urls.includes('https://x.com/not_harbour/status/42'));
    assert.equal(urls.some((url) => url.includes('/status/77')), false);
    assert.equal(result.findings.find((finding) => finding.sourceUrl.endsWith('/status/42'))?.category, 'FAKE_CONTEST');
    assert.equal(result.findings.find((finding) => finding.sourceUrl.endsWith('harbourfest_gw'))?.category, 'IMPERSONATION_PROFILE');
    assert.equal(result.verifications.length, 0);
  });

  it('stops on HTTP 429 and does not send another request', async () => {
    const tracked = trackingClient(() => page('https://api.twitter.com/2/users/by', 429, ''));
    const result = await collectX([demoOrg()], tracked.client, 'bearer-token');
    assert.equal(result.stop?.state, 'BLOCKED');
    assert.equal(result.stop?.detail, 'http 429');
    assert.equal(tracked.urls.length, 1);
    assert.equal(result.findings.length, 0);
  });

  it('stops on HTTP 401 from the user lookup', async () => {
    const tracked = trackingClient(() => page('https://api.twitter.com/2/users/by', 401, ''));
    const result = await collectX([demoOrg()], tracked.client, 'bearer-token');
    assert.equal(result.stop?.detail, 'http 401');
    assert.equal(tracked.urls.length, 1);
  });
});
