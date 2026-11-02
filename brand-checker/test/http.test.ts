import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import { readFixtureSample } from '../src/fixtures.js';
import {
  MAX_RESPONSE_BYTES,
  UnsafeUrlError,
  assertPublicHttpsUrl,
  createApiFetchClient,
  createFetchClient,
  isBlockedAddress,
  type PinnedAgent,
} from '../src/http.js';
import { collectReddit, redditUserAgent } from '../src/sources/reddit.js';
import { collectX } from '../src/sources/x.js';
import { demoOrg, page } from './helpers.js';
import type { HttpClient } from '../src/types.js';

const publicLookup = async () => [{ address: '8.8.8.8', family: 4 }];
const privateLookup = async () => [{ address: '10.1.2.3', family: 4 }];

const response = (status: number, body: string, headers: Record<string, string> = {}, url = 'https://crt.sh/') => ({
  status,
  url,
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  text: async () => body,
  body: null,
});

describe('public fetch safety', () => {
  it('blocks private, loopback, link-local, CGNAT, NAT64, and mapped forms', () => {
    const blocked = [
      '127.0.0.1',
      '10.0.0.8',
      '192.168.1.9',
      '172.16.0.1',
      '169.254.169.254',
      '0.0.0.1',
      '100.64.0.1',
      '100.127.255.255',
      '192.0.0.1',
      '192.0.0.255',
      '::ffff:c000:1',
      '198.18.0.1',
      '198.19.255.255',
      '224.0.0.1',
      '240.0.0.1',
      '255.255.255.255',
      '::1',
      '::',
      'fe80::1',
      'febf::1',
      'fc00::1',
      'fd12::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:7f00:0001',
      '0:0:0:0:0:ffff:7f00:1',
      '::ffff:a9fe:a9fe',
      '::ffff:6440:1',
      '::7f00:1',
      '[::1]',
      '64:ff9b::7f00:1',
      '64:ff9b::8.8.8.8',
      '64:ff9b::808:808',
      '2002::1',
      '2002:c000:201::',
      '2001::1',
      '2001:0:4136:e378:8000:63bf:3fff:fdd2',
    ];
    for (const address of blocked) assert.equal(isBlockedAddress(address), true, address);
    assert.equal(isBlockedAddress('8.8.8.8'), false);
    assert.equal(isBlockedAddress('1.1.1.1'), false);
    assert.equal(isBlockedAddress('100.128.0.1'), false);
    assert.equal(isBlockedAddress('192.0.1.1'), false);
    assert.equal(isBlockedAddress('198.20.0.1'), false);
    assert.equal(isBlockedAddress('::ffff:8.8.8.8'), false);
    assert.equal(isBlockedAddress('::ffff:808:808'), false);
    assert.equal(isBlockedAddress('2001:4860:4860::8888'), false);
  });

  it('refuses a hostname that resolves to a private address', async () => {
    await assert.rejects(
      () => assertPublicHttpsUrl('https://example.test/path', privateLookup),
      /private address/
    );
  });

  it('pins the checked address for the connection and each redirect hop', async () => {
    const answers = [
      [
        { address: '8.8.8.8', family: 4 },
        { address: '1.1.1.1', family: 4 },
      ],
      [{ address: '9.9.9.9', family: 4 }],
    ];
    let lookups = 0;
    const pinned: string[] = [];
    let fetches = 0;
    const client = createFetchClient({
      lookup: async () => {
        const answer = answers[lookups];
        lookups += 1;
        if (!answer) throw new Error('lookup called again');
        return answer;
      },
      fetchImpl: async (url, init) => {
        fetches += 1;
        const dispatcher = init.dispatcher as PinnedAgent;
        const address = await new Promise<string>((resolve, reject) => {
          dispatcher.connectLookup('re-resolved.example', { all: true }, (err, found) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(Array.isArray(found) ? found[0].address : found);
          });
        });
        pinned.push(address);
        if (fetches === 1) {
          return response(302, '', { location: 'https://www.crt.sh/json' }, url) as unknown as Response;
        }
        return response(200, 'ok', {}, url) as unknown as Response;
      },
    });
    const result = await client.request('https://crt.sh/start');
    assert.equal(result.status, 200);
    assert.equal(lookups, 2);
    assert.deepEqual(pinned, ['8.8.8.8', '9.9.9.9']);
  });

  it('cancels a redirect body over 70KB before the next hop', async () => {
    const size = 70 * 1024 + 1;
    let cancelled = false;
    const started = Date.now();
    const client = createFetchClient({
      lookup: publicLookup,
      timeoutMs: 2_000,
      fetchImpl: async (url) => {
        if (url.endsWith('/start')) {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(size));
            },
            pull() {
              return new Promise(() => {
                // The remainder never arrives. Cancelling is what lets the hop finish.
              });
            },
            cancel() {
              cancelled = true;
            },
          });
          return new Response(stream, {
            status: 302,
            headers: { location: 'https://www.crt.sh/json' },
          });
        }
        return new Response('ok', { status: 200 });
      },
    });
    const result = await client.request('https://crt.sh/start');
    assert.equal(result.status, 200);
    assert.equal(result.body, 'ok');
    assert.equal(cancelled, true);
    assert.ok(Date.now() - started < 1_000);
  });

  it('cancels an unread body when a redirect is refused', async () => {
    let cancelled = false;
    const started = Date.now();
    const client = createFetchClient({
      lookup: publicLookup,
      timeoutMs: 2_000,
      fetchImpl: async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(70 * 1024 + 1));
          },
          pull() {
            return new Promise(() => undefined);
          },
          cancel() {
            cancelled = true;
          },
        });
        return new Response(stream, {
          status: 302,
          headers: { location: 'https://evil.test/phish' },
        });
      },
    });
    await assert.rejects(() => client.request('https://crt.sh/'), /https/);
    assert.equal(cancelled, true);
    assert.ok(Date.now() - started < 1_000);
  });

  it('does not connect when any resolved address is blocked', async () => {
    let fetches = 0;
    const client = createFetchClient({
      lookup: async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '::ffff:7f00:1', family: 6 },
      ],
      fetchImpl: async () => {
        fetches += 1;
        return response(200, 'ok') as unknown as Response;
      },
    });
    await assert.rejects(() => client.request('https://crt.sh/'), /private address/);
    assert.equal(fetches, 0);
  });

  it('follows only a same-site https redirect', async () => {
    const urls: string[] = [];
    const client = createFetchClient({
      lookup: publicLookup,
      fetchImpl: async (url, init) => {
        urls.push(url);
        assert.equal(init.redirect, 'manual');
        if (urls.length === 1) {
          return response(302, '', { location: 'https://www.crt.sh/json' }, url) as unknown as Response;
        }
        return response(200, '{"ok":true}', {}, url) as unknown as Response;
      },
    });
    const result = await client.request('https://crt.sh/start');
    assert.equal(result.status, 200);
    assert.deepEqual(urls, ['https://crt.sh/start', 'https://www.crt.sh/json']);
  });

  it('does not follow an off-site or http redirect', async () => {
    const client = createFetchClient({
      lookup: publicLookup,
      fetchImpl: async (url) => response(302, '', { location: 'https://evil.test/phish' }, url) as unknown as Response,
    });
    await assert.rejects(() => client.request('https://crt.sh/'), UnsafeUrlError);
    const httpRedirect = createFetchClient({
      lookup: publicLookup,
      fetchImpl: async (url) => response(302, '', { location: 'http://crt.sh/' }, url) as unknown as Response,
    });
    await assert.rejects(() => httpRedirect.request('https://crt.sh/'), /https/);
  });

  it('caps a response body at about 2MB', async () => {
    const client = createFetchClient({
      lookup: publicLookup,
      fetchImpl: async (url) => response(200, 'x'.repeat(MAX_RESPONSE_BYTES + 1), {}, url) as unknown as Response,
    });
    await assert.rejects(() => client.request('https://crt.sh/'), /2MB/);
  });

  it('sets redirect error on the Tixmo API client', async () => {
    let redirect: string | undefined;
    const client = createApiFetchClient({
      fetchImpl: async (url, init) => {
        redirect = init.redirect;
        return response(200, 'ok', {}, url) as unknown as Response;
      },
    });
    const result = await client.request('http://127.0.0.1:3000/health');
    assert.equal(redirect, 'error');
    assert.equal(result.body, 'ok');
  });
});

describe('fixtures safety', () => {
  it('refuses a non-loopback API URL', () => {
    assert.throws(
      () =>
        loadConfig(['--fixtures'], {
          TIXMO_API_URL: 'https://api.example.test',
          TIXMO_CHECKER_TOKEN: 'gwc_localtokenvalue123456',
        }),
      /loopback/
    );
    const local = loadConfig(['--fixtures'], {
      TIXMO_API_URL: 'http://127.0.0.1:3000',
      TIXMO_CHECKER_TOKEN: 'gwc_localtokenvalue123456',
    });
    assert.equal(local.apiUrl, 'http://127.0.0.1:3000');
  });

  it('fails clearly when a fixture sample is absent', () => {
    assert.throws(() => readFixtureSample('missing-sample.json'), /not available/);
  });
});

describe('identifying user agents', () => {
  it('sends a versioned contact User-Agent to X and the Reddit format', async () => {
    const seen: string[] = [];
    const http: HttpClient = {
      async request(url, init) {
        seen.push(init?.headers?.['User-Agent'] ?? '');
        return page(url, 401, '');
      },
    };
    const agent = 'TixmoBrandChecker/1.0 (+http://127.0.0.1:5173/brand-protection)';
    await collectX([demoOrg()], http, 'bearer', new Date(), agent);
    assert.equal(seen[0], agent);
    const reddit = redditUserAgent('http://127.0.0.1:5173/brand-protection', 'harbourfest');
    assert.equal(reddit, 'tixmo:brand-checker:1.0 (by /u/harbourfest)');
    await collectReddit([demoOrg()], http, 'id', 'secret', new Date(), reddit);
    assert.equal(seen[1], reddit);
  });
});
