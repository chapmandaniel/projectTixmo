import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Pace } from '../src/pace.js';
import { createFixtureClient } from '../src/fixtures.js';
import { collectFacebook } from '../src/sources/facebook.js';
import { demoOrg, page, trackingClient } from './helpers.js';

const agent = 'TixmoBrandChecker/1.0 (+http://127.0.0.1:5173/brand-protection)';

describe('Facebook', () => {
  it('reads the bundled public page', async () => {
    const result = await collectFacebook(
      [demoOrg()],
      createFixtureClient(),
      new Pace(0),
      agent,
      new Date('2026-11-02T12:00:00.000Z')
    );
    assert.equal(result.stop, undefined);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].category, 'IMPERSONATION_PROFILE');
    assert.equal(result.findings[0].platformAccountId, '888001');
    assert.equal(result.findings[0].sourceUrl.includes('facebook.com/harbourfesttickets'), true);
  });

  it('stops at a login wall and does not fetch another page', async () => {
    const tracked = trackingClient((url) =>
      page(url, 200, '<html>log in to continue</html>', 'https://www.facebook.com/login/')
    );
    const result = await collectFacebook([demoOrg()], tracked.client, new Pace(0), agent);
    assert.equal(result.stop?.state, 'LOGIN_PROMPT');
    assert.equal(tracked.urls.length, 1);
    assert.equal(result.findings.length, 0);
  });

  it('stops at a captcha', async () => {
    const tracked = trackingClient((url) => page(url, 200, '<div class="g-recaptcha"></div>'));
    const result = await collectFacebook([demoOrg()], tracked.client, new Pace(0), agent);
    assert.equal(result.stop?.state, 'CAPTCHA');
    assert.equal(tracked.urls.length, 1);
  });

  it('stops on HTTP 429 and does not retry', async () => {
    const tracked = trackingClient((url) => page(url, 429, ''));
    const result = await collectFacebook([demoOrg()], tracked.client, new Pace(0), agent);
    assert.equal(result.stop?.state, 'BLOCKED');
    assert.equal(result.stop?.detail, 'http 429');
    assert.equal(tracked.urls.length, 1);
  });

  it('waits between public pages', async () => {
    const delays: number[] = [];
    const tracked = trackingClient((url) => page(url, 404, '<html><title>Page not found</title></html>'));
    await collectFacebook(
      [demoOrg()],
      tracked.client,
      new Pace(15_000, async (ms) => {
        delays.push(ms);
      }),
      agent
    );
    assert.equal(tracked.urls.length, 2);
    assert.deepEqual(delays, [15_000]);
  });
});
