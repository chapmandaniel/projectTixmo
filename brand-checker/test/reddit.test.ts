import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFixtureClient } from '../src/fixtures.js';
import { collectReddit } from '../src/sources/reddit.js';
import { demoOrg, page, trackingClient } from './helpers.js';

describe('Reddit', () => {
  it('reads official API fixtures and keeps the Reddit permalink', async () => {
    const result = await collectReddit(
      [demoOrg()],
      createFixtureClient(),
      'fixture-id',
      'fixture-secret',
      new Date('2026-11-02T12:00:00.000Z')
    );
    assert.equal(result.stop, undefined);
    const association = result.findings.find((finding) => finding.category === 'FALSE_ASSOCIATION');
    const profile = result.findings.find((finding) => finding.category === 'IMPERSONATION_PROFILE');
    assert.equal(association?.sourceUrl, 'https://reddit.com/r/stjohns/comments/assoc1/we_are_harbour_fest');
    assert.equal(profile?.sourceUrl, 'https://reddit.com/user/harbourfest_prizes');
    assert.equal(result.findings.some((finding) => finding.sourceUrl.includes('kijiji')), false);
  });

  it('stops on HTTP 429 after the token request and does not search again', async () => {
    const tracked = trackingClient((url) => {
      if (url.includes('access_token')) {
        return page(url, 200, JSON.stringify({ access_token: 'reddit-token', token_type: 'bearer' }));
      }
      return page(url, 429, '');
    });
    const result = await collectReddit([demoOrg()], tracked.client, 'id', 'secret');
    assert.equal(result.stop?.state, 'BLOCKED');
    assert.equal(result.stop?.detail, 'http 429');
    assert.equal(tracked.urls.length, 2);
    assert.equal(tracked.urls[1].includes('/search'), true);
  });

  it('stops when the token endpoint returns 401', async () => {
    const tracked = trackingClient((url) => page(url, 401, ''));
    const result = await collectReddit([demoOrg()], tracked.client, 'id', 'secret');
    assert.equal(result.stop?.detail, 'http 401');
    assert.equal(tracked.urls.length, 1);
  });
});
