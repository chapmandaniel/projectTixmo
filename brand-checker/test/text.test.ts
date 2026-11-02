import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifySocial } from '../src/classify.js';
import { isRejectedSource, redact } from '../src/text.js';
import { demoOrg } from './helpers.js';

describe('text safety', () => {
  it('redacts checker tokens, bearer secrets, emails, and phones', () => {
    const line = redact(
      'token gwc_supersecretvalue123 Bearer abcdef email prizes@scam.example phone +17095550199'
    );
    assert.equal(line.includes('gwc_super'), false);
    assert.equal(line.includes('abcdef'), false);
    assert.equal(line.includes('prizes@'), false);
    assert.equal(line.includes('709555'), false);
    assert.match(line, /gwc_\[redacted\]/);
    assert.match(line, /\[redacted-email\]/);
    assert.match(line, /\[redacted-phone\]/);
  });

  it('rejects marketplace and resale hosts', () => {
    assert.equal(isRejectedSource('https://www.kijiji.ca/v-community/harbour-fest'), true);
    assert.equal(isRejectedSource('https://stjohns.craigslist.org/tickets/1.html'), true);
    assert.equal(isRejectedSource('https://www.facebook.com/marketplace/item/1'), true);
    assert.equal(isRejectedSource('https://x.com/harbourfest_gw'), false);
  });
});

describe('classifySocial', () => {
  const now = new Date('2026-11-02T12:00:00.000Z');

  it('skips the official platform account id even when the text is a contest', () => {
    const finding = classifySocial(
      demoOrg(),
      {
        platform: 'X',
        sourceUrl: 'https://x.com/harbourfest/status/77',
        platformAccountId: '1000000001',
        accountHandle: 'harbourfest',
        suspectDisplayName: 'Harbour Fest',
        text: 'Harbour Fest giveaway starts tomorrow',
      },
      now
    );
    assert.equal(finding, null);
  });

  it('does not treat a copied handle with a different id as official', () => {
    const finding = classifySocial(
      demoOrg(),
      {
        platform: 'X',
        sourceUrl: 'https://x.com/harbourfest',
        platformAccountId: '999',
        accountHandle: 'harbourfest',
        suspectDisplayName: 'Someone',
        text: 'hello',
      },
      now
    );
    assert.equal(finding?.category, 'IMPERSONATION_PROFILE');
  });
});
