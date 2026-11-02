import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FatalApiError, TixmoClient } from '../src/ingest.js';
import type { Finding, HttpClient, Logger } from '../src/types.js';

const finding = (sourceUrl: string): Finding => ({
  organizationId: '11111111-1111-4111-8111-111111111111',
  platform: 'X',
  category: 'FAKE_CONTEST',
  sourceUrl,
  matchedRule: 'fake-contest-language',
  detectedAt: '2026-11-01T15:00:00.000Z',
  matchedText: 'Harbour Fest contest',
});

const loggerWith = (lines: string[]): Logger => ({
  info(message) {
    lines.push(message);
  },
  alert(message) {
    lines.push(message);
  },
});

const clientFor = (status: number, lines: string[], bodies: unknown[]) => {
  let calls = 0;
  const http: HttpClient = {
    async request(url, init) {
      calls += 1;
      bodies.push(JSON.parse(init?.body ?? '{}'));
      return { status, url, body: '' };
    },
  };
  const client = new TixmoClient({
    apiUrl: 'http://127.0.0.1:3000',
    token: 'gwc_localtokenvalue123456',
    http,
    logger: loggerWith(lines),
    onFatal: () => undefined,
  });
  return { client, calls: () => calls };
};

describe('Tixmo ingest client', () => {
  for (const status of [429, 401, 404]) {
    it(`stops on HTTP ${status} without a second request`, async () => {
      const lines: string[] = [];
      const bodies: unknown[] = [];
      const harness = clientFor(status, lines, bodies);
      await assert.rejects(() => harness.client.submitMatches([finding('https://x.com/not_harbour/status/42')]), FatalApiError);
      assert.equal(harness.calls(), 1);
      assert.match(lines[0], new RegExp(`ALERT brand-checker: Tixmo API returned ${status}`));
      assert.equal(lines[0].includes('gwc_local'), false);
      assert.equal(lines[0].includes('stopping'), true);
    });
  }

  it('sends lookalike rows as the domain only', async () => {
    const bodies: unknown[] = [];
    const harness = clientFor(200, [], bodies);
    const domain: Finding = {
      organizationId: '11111111-1111-4111-8111-111111111111',
      platform: 'LOOKALIKE_DOMAIN',
      category: 'LOOKALIKE_DOMAIN',
      sourceUrl: 'harbourfest-tickets.example',
      matchedRule: 'lookalike-certificate',
      detectedAt: '2026-11-02T12:00:00.000Z',
    };
    await harness.client.submitMatches([domain]);
    const matches = (bodies[0] as { matches: Record<string, unknown>[] }).matches;
    assert.deepEqual(Object.keys(matches[0]).sort(), [
      'category',
      'detectedAt',
      'matchedRule',
      'organizationId',
      'platform',
      'sourceUrl',
    ]);
  });
});
