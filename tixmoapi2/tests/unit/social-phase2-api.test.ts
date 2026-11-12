import { planSandboxGraphRequest } from '../../src/social/graph-guard';
import { sandboxGraphGet, parseAccountsList, graphErrorCode } from '../../src/social/graph-client';
import { socialLogLine } from '../../src/social/log';
import { readSocialConfig, toPublicSocialConfig } from '../../src/social/config';
import { sealSandboxToken } from '../../src/social/token-policy';
import { loadKeyRing } from '../../src/social/token-crypto';
import { triggerCapturedSocialEmail } from '../../src/social/email-trigger';
import {
  clearCapturedSocialEmails,
  listCapturedSocialEmails,
} from '../../src/social/email-capture';

const ROOT = '33'.repeat(32);

describe('phase 2 sandbox graph client', () => {
  it('plans only allowlisted sandbox hosts and parses account lists', async () => {
    const planned = planSandboxGraphRequest(
      'https://meta-graph-sandbox-production.up.railway.app/v19.0/me'
    );
    expect(planned.sandbox).toBe(true);
    expect(() => planSandboxGraphRequest('https://graph.facebook.com/v19.0/me')).toThrow(
      /not allowlisted|not allowed/
    );

    const result = await sandboxGraphGet({
      baseUrl: 'https://meta-graph-sandbox-production.up.railway.app',
      path: '/me/accounts',
      accessToken: 'sbx_test_token',
      fetcher: () =>
        Promise.resolve({
          status: 200,
          headers: { 'x-sandbox': 'true' },
          json: {
            data: [
              {
                id: 'page-1',
                name: 'Harbourfest Test',
                instagram_business_account: { id: 'ig-1', username: 'harbourfest_sbx' },
              },
            ],
          },
        }),
    });
    expect(result.host).toBe('meta-graph-sandbox-production.up.railway.app');
    expect(parseAccountsList(result.json)[0].linkedInstagramUsername).toBe('harbourfest_sbx');
    expect(graphErrorCode({ error: { code: 4 } })).toBe('4');
  });

  it('refuses live tokens and omits secrets from structured logs and public config', () => {
    const ring = loadKeyRing({ SOCIAL_TOKEN_ENCRYPTION_KEY: ROOT });
    expect(() =>
      sealSandboxToken({
        token: 'EAAB1234567890',
        organizationId: 'org',
        connectionId: 'conn',
        tokenKind: 'sandbox',
        graphBaseUrl: 'https://meta-graph-sandbox-production.up.railway.app',
        ring,
      })
    ).toThrow(/Real-looking/);
    expect(() =>
      sealSandboxToken({
        token: 'sbx_ok',
        organizationId: 'org',
        connectionId: 'conn',
        tokenKind: 'live',
        graphBaseUrl: 'https://meta-graph-sandbox-production.up.railway.app',
        ring,
      })
    ).toThrow(/Live tokens/);

    const line = socialLogLine('graph.outbound', {
      organizationId: 'org',
      host: 'meta-graph-sandbox-production.up.railway.app',
      path: '/me/accounts',
      status: 200,
    });
    expect(JSON.stringify(line)).not.toMatch(/sbx_|tokenCiphertext|authorization/i);

    const config = readSocialConfig({
      SOCIAL_COMMAND_CENTER_ENABLED: 'true',
      SOCIAL_SANDBOX_BASE_URL: 'https://meta-graph-sandbox-production.up.railway.app',
      SOCIAL_TOKEN_ENCRYPTION_KEY: ROOT,
      SOCIAL_POLL_ENABLED: 'true',
      SOCIAL_EMAIL_CAPTURE: 'true',
    });
    expect(config.phase).toBe('data');
    expect(config.pollEnabled).toBe(true);
    const published = JSON.stringify(toPublicSocialConfig(config));
    expect(published).not.toMatch(/SOCIAL_TOKEN|sbx_|teamAccess|railway\.app/i);
    expect(published).toMatch(/"pollEnabled":true/);
  });
});

describe('phase 2 email capture trigger', () => {
  beforeEach(() => clearCapturedSocialEmails());

  it('writes metadata-only HIGH and digest captures when capture is on', async () => {
    const env = {
      SOCIAL_EMAIL_CAPTURE: 'true',
      SOCIAL_COMMAND_CENTER_ENABLED: 'true',
      SOCIAL_SANDBOX_BASE_URL: 'https://meta-graph-sandbox-production.up.railway.app',
      SOCIAL_TOKEN_ENCRYPTION_KEY: ROOT,
    };
    const previous = { ...process.env };
    Object.assign(process.env, env);
    try {
      const high = await triggerCapturedSocialEmail({
        organizationId: 'org-a',
        role: 'OWNER',
        kind: 'high',
        severity: 'HIGH',
        topic: 'Safety',
        state: 'NEW',
        commentCount: 1,
        eventName: 'Harbourfest',
        ruleName: 'Safety keyword',
        dashboardUrl: '/social?tab=issues',
      });
      expect(high.status).toBe('captured');
      const digest = await triggerCapturedSocialEmail({
        organizationId: 'org-a',
        role: 'ADMIN',
        kind: 'digest',
        eventName: 'Harbourfest',
        dashboardUrl: '/social',
      });
      expect(digest.status).toBe('captured');
      const rows = listCapturedSocialEmails('org-a');
      expect(rows).toHaveLength(2);
      const blob = JSON.stringify(rows);
      expect(blob).not.toMatch(/injured|@fan|caption/i);
      expect(blob).toMatch(/Open in Tixmo/);
    } finally {
      process.env = previous;
    }
  });

  it('refuses the trigger when capture is off', async () => {
    const previous = { ...process.env };
    delete process.env.SOCIAL_EMAIL_CAPTURE;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    process.env.SOCIAL_COMMAND_CENTER_ENABLED = 'true';
    process.env.SOCIAL_SANDBOX_BASE_URL = 'https://meta-graph-sandbox-production.up.railway.app';
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = ROOT;
    try {
      await expect(
        triggerCapturedSocialEmail({
          organizationId: 'org-a',
          role: 'OWNER',
          kind: 'high',
        })
      ).rejects.toThrow(/capture is not enabled/i);
    } finally {
      process.env = previous;
    }
  });
});
