import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Pace } from '../src/pace.js';
import { createFixtureClient } from '../src/fixtures.js';
import { collectInstagram } from '../src/sources/instagram.js';
import { demoOrg, page, trackingClient } from './helpers.js';

const agent = 'TixmoBrandChecker/1.0 (+http://127.0.0.1:5173/brand-protection)';

describe('Instagram', () => {
  it('reads the bundled public page and keeps contact details on the finding only', async () => {
    const result = await collectInstagram(
      [demoOrg()],
      createFixtureClient(),
      new Pace(0),
      agent,
      new Date('2026-11-02T12:00:00.000Z')
    );
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].category, 'FAKE_CONTEST');
    assert.deepEqual(result.findings[0].evidenceEmails, ['prizes@scam.example']);
    assert.ok(result.findings[0].evidencePhones?.some((phone) => phone.includes('7095550199')));
  });

  it('stops at a login wall and does not fetch another page', async () => {
    const tracked = trackingClient((url) =>
      page(url, 200, '<html>log in to instagram</html>', 'https://www.instagram.com/accounts/login/')
    );
    const result = await collectInstagram([demoOrg()], tracked.client, new Pace(0), agent);
    assert.equal(result.stop?.state, 'LOGIN_PROMPT');
    assert.equal(tracked.urls.length, 1);
  });

  it('stops at a captcha', async () => {
    const tracked = trackingClient((url) => page(url, 200, '<form>verify you are human</form>'));
    const result = await collectInstagram([demoOrg()], tracked.client, new Pace(0), agent);
    assert.equal(result.stop?.state, 'CAPTCHA');
    assert.equal(tracked.urls.length, 1);
  });

  it('stops on HTTP 429 and does not retry', async () => {
    const tracked = trackingClient((url) => page(url, 429, ''));
    const result = await collectInstagram([demoOrg()], tracked.client, new Pace(0), agent);
    assert.equal(result.stop?.detail, 'http 429');
    assert.equal(tracked.urls.length, 1);
  });
});
