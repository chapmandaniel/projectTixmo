import { planSandboxGraphRequest } from '../../src/social/graph-guard';
import {
  decryptSocialToken,
  encryptSocialToken,
  loadKeyRing,
  parseSocialRootKey,
} from '../../src/social/token-crypto';
import { disconnectConnection, sealSandboxToken, tokenShape } from '../../src/social/token-policy';
import { readSocialConfig, toPublicSocialConfig } from '../../src/social/config';
import { scrubSocialTelemetry, socialRequestLogPath } from '../../src/social/redaction';
import {
  buildDigestEmail,
  buildHighAlertEmail,
  highAlertRecipients,
} from '../../src/social/alert-email';
import {
  clearCapturedSocialEmails,
  listCapturedSocialEmails,
  requireCaptureReader,
  socialMailShouldCapture,
} from '../../src/social/email-capture';
import { deliverDigest, deliverHighAlert } from '../../src/social/social-mailer';
import { commentRetentionDecision } from '../../src/social/retention';
import { planPoll, readPollConfig, successivePolls } from '../../src/social/polling';
import { classifyComments, listEmailCaptures } from '../../src/api/social/controller';
import type { AuthRequest } from '../../src/middleware/auth';
import type { Response } from 'express';

const ROOT = '11'.repeat(32);
const PREVIOUS = '22'.repeat(32);
const COMMENT = 'my QR code will not load in the app';
const HANDLE = '@harbourfan';

const highInput = {
  organizationId: 'org-a',
  to: ['sam@festival.test', 'owner@festival.test'],
  severity: 'HIGH',
  topic: 'Ticketing',
  state: 'NEW',
  commentCount: 23,
  eventName: 'Harbourfest 2027',
  detectedAt: '2026-07-15T15:10:00.000Z',
  unansweredDuration: '30 min',
  assignee: 'Sam R.',
  ruleName: 'Ticketing spike',
  dashboardUrl: 'https://labs.example/social/issues/wave-1',
};

describe('sandbox token envelope', () => {
  const ring = loadKeyRing({
    SOCIAL_TOKEN_ENCRYPTION_KEY: ROOT,
    SOCIAL_TOKEN_ENCRYPTION_KEY_PREVIOUS: PREVIOUS,
  });
  const context = {
    organizationId: 'org-a',
    connectionId: 'conn-1',
    tokenKind: 'sandbox' as const,
  };

  it('uses a unique nonce and round-trips only in the same context', () => {
    const first = encryptSocialToken('sbx_one', context, ring);
    const second = encryptSocialToken('sbx_one', context, ring);
    expect(first).not.toBe(second);
    expect(first.startsWith(`v1:${ring.current.keyId}:`)).toBe(true);
    expect(decryptSocialToken(first, context, ring)).toBe('sbx_one');
    expect(() => decryptSocialToken(first, { ...context, organizationId: 'org-b' }, ring)).toThrow(
      /could not be read/
    );
    expect(() => decryptSocialToken(first, { ...context, connectionId: 'conn-2' }, ring)).toThrow(
      /could not be read/
    );
    expect(() => decryptSocialToken(first, { ...context, tokenKind: 'live' }, ring)).toThrow(
      /could not be read/
    );
  });

  it('decrypts a previous key and accepts a 32-byte base64 root', () => {
    const previousRing = loadKeyRing({ SOCIAL_TOKEN_ENCRYPTION_KEY: PREVIOUS });
    const envelope = encryptSocialToken('sbx_old', context, previousRing);
    expect(decryptSocialToken(envelope, context, ring)).toBe('sbx_old');
    const base64 = Buffer.from(ROOT, 'hex').toString('base64');
    expect(parseSocialRootKey(base64, 'SOCIAL_TOKEN_ENCRYPTION_KEY')).toEqual(
      Buffer.from(ROOT, 'hex')
    );
  });

  it('refuses real-looking tokens and real Graph hosts before anything is stored', () => {
    expect(tokenShape('EAABreal')).toBe('real');
    expect(tokenShape('IGQreal')).toBe('real');
    expect(tokenShape('12345|secret')).toBe('real');
    expect(tokenShape('sbx_ok')).toBe('sandbox');
    for (const token of ['EAABreal', 'IGQreal', '12345|secret']) {
      expect(() =>
        sealSandboxToken({
          token,
          organizationId: 'org-a',
          connectionId: 'conn-1',
          tokenKind: 'sandbox',
          graphBaseUrl: 'https://meta-graph-sandbox-production.up.railway.app',
          ring,
        })
      ).toThrow(/refused/);
    }
    expect(() =>
      sealSandboxToken({
        token: 'sbx_ok',
        organizationId: 'org-a',
        connectionId: 'conn-1',
        tokenKind: 'live',
        graphBaseUrl: 'https://meta-graph-sandbox-production.up.railway.app',
        ring,
      })
    ).toThrow(/Live tokens are refused/);
    expect(() => planSandboxGraphRequest('https://graph.facebook.com/v21.0/me')).toThrow(
      /not allowlisted/
    );
    expect(() => planSandboxGraphRequest('https://graph.instagram.com/v21.0/me')).toThrow(
      /not allowlisted/
    );
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('no egress'));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    const sealed = sealSandboxToken({
      token: 'sbx_ok',
      organizationId: 'org-a',
      connectionId: 'conn-1',
      tokenKind: 'sandbox',
      graphBaseUrl: 'https://meta-graph-sandbox-production.up.railway.app/v21.0',
      ring,
    });
    expect(sealed.tokenKind).toBe('sandbox');
    expect(sealed.ciphertext.includes('sbx_ok')).toBe(false);
    const disconnected = disconnectConnection({
      id: 'conn-1',
      organizationId: 'org-a',
      status: 'CONNECTED',
      tokenKind: 'sandbox',
      tokenCiphertext: sealed.ciphertext,
      refreshCiphertext: null,
      lookupHmac: sealed.lookupHmac,
      graphBaseUrl: sealed.graphBaseUrl,
    });
    expect(disconnected.tokenCiphertext).toBeNull();
    expect(disconnected.lookupHmac).toBeNull();
    expect(disconnected.status).toBe('DISCONNECTED');
  });

  it('publishes no secrets and scrubs tokens from logs and telemetry', () => {
    const config = readSocialConfig({
      SOCIAL_COMMAND_CENTER_ENABLED: 'true',
      SOCIAL_SANDBOX_BASE_URL: 'https://meta-graph-sandbox-production.up.railway.app',
      SOCIAL_SANDBOX_TEAM_ACCESS_KEY: 'team-secret',
      SOCIAL_TOKEN_ENCRYPTION_KEY: ROOT,
      EMAIL_FROM: 'alerts@example.test',
    });
    const published = JSON.stringify(toPublicSocialConfig(config));
    expect(published).not.toContain('team-secret');
    expect(published).not.toContain(ROOT);
    expect(config.alertFrom).toBe('alerts@example.test');
    expect(socialRequestLogPath('/api/v1/social/config?access_token=sbx_secret')).toBe(
      '/api/v1/social/config'
    );
    expect(socialRequestLogPath('/api/v1/orders?status=paid')).toBeNull();
    const event = scrubSocialTelemetry({
      request: {
        url: 'https://graph.facebook.com/v21.0/me?access_token=sbx_secret',
        headers: { authorization: 'Bearer sbx_secret' },
        data: { access_token: 'sbx_secret', tokenCiphertext: 'v1:abc' },
      },
    });
    expect(JSON.stringify(event)).not.toContain('sbx_secret');
    expect(JSON.stringify(event)).not.toContain('v1:abc');
    expect(event.request?.url).toBe('/v21.0/me');
  });
});

describe('retention, polling, and captured mail', () => {
  beforeEach(() => clearCapturedSocialEmails());

  it('keeps comment text for 14 days and longer while an issue is open', () => {
    const createdAt = new Date('2026-07-01T00:00:00.000Z');
    const within = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000 - 1);
    const expired = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(commentRetentionDecision({ now: within, createdAt }).reason).toBe('within-ttl');
    expect(commentRetentionDecision({ now: expired, createdAt }).reason).toBe('expired');
    expect(
      commentRetentionDecision({ now: expired, createdAt, issueStates: ['HANDLED'] })
        .keepBodyAndHandle
    ).toBe(false);
    expect(
      commentRetentionDecision({ now: expired, createdAt, issueStates: ['IN_PROGRESS'] })
    ).toEqual({ keepBodyAndHandle: true, reason: 'open-issue-hold' });
    expect(
      commentRetentionDecision({ now: expired, createdAt, issueStates: ['NEW', 'DISMISSED'] })
        .reason
    ).toBe('open-issue-hold');
    expect(
      commentRetentionDecision({
        now: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt,
        retentionDays: 7,
      }).reason
    ).toBe('expired');
  });

  it('plans a configurable poll every 5 minutes, or every 1 minute on event day, without polling', () => {
    const start = new Date('2026-07-15T15:00:00.000Z');
    const defaults = readPollConfig({});
    const normal = successivePolls(start, planPoll(defaults, 'NORMAL', start).intervalMs, 2);
    const eventDay = successivePolls(start, planPoll(defaults, 'EVENT_DAY', start).intervalMs, 2);
    expect(Date.parse(normal[1]) - Date.parse(normal[0])).toBe(5 * 60 * 1000);
    expect(Date.parse(eventDay[1]) - Date.parse(eventDay[0])).toBe(60 * 1000);
    expect(planPoll(defaults, 'NORMAL', start).lookbackMs).toBe(14 * 24 * 60 * 60 * 1000);
    expect(planPoll(defaults, 'EVENT_DAY', start).lookbackMs).toBe(48 * 60 * 60 * 1000);
    expect(planPoll(defaults, 'EVENT_DAY', start).running).toBe(false);
    const custom = readPollConfig({
      SOCIAL_POLL_INTERVAL_MS: '120000',
      SOCIAL_POLL_EVENT_DAY_INTERVAL_MS: '15000',
    });
    expect(planPoll(custom, 'ON_SALE_DAY', start).intervalMs).toBe(120000);
    expect(planPoll(custom, 'EVENT_DAY', start).intervalMs).toBe(15000);
  });

  it('captures metadata-only alert and digest mail and never includes a comment or handle', async () => {
    const send = jest.fn();
    const captured = await deliverHighAlert(highInput, { SOCIAL_EMAIL_CAPTURE: 'true' }, { send });
    expect(captured.status).toBe('captured');
    expect(send).not.toHaveBeenCalled();
    const stored = JSON.stringify(listCapturedSocialEmails('org-a'));
    expect(stored).not.toContain(COMMENT);
    expect(stored).not.toContain(HANDLE);
    expect(stored).toContain('Open in Tixmo');
    expect(stored).toContain('Comments in this issue: 23');
    expect(stored).not.toContain('"handle"');
    expect(stored).not.toContain('"caption"');

    expect(() =>
      buildHighAlertEmail({ ...highInput, comment: COMMENT } as typeof highInput)
    ).toThrow(/comment text or handles/);
    expect(() =>
      buildDigestEmail({
        organizationId: 'org-a',
        to: ['owner@festival.test'],
        eventName: 'Harbourfest 2027',
        openBySeverity: { HIGH: 1 },
        openByTopic: { Ticketing: 1 },
        unansweredCount: 2,
        oldestUnansweredAge: '9h',
        newYesterday: 3,
        handledYesterday: 1,
        topPost: {
          postedAt: '2026-07-14T18:00:00.000Z',
          platform: 'IG',
          reach: '9800',
          caption: 'Doors 4pm',
        } as {
          postedAt: string;
          platform: string;
          reach: string;
        },
        dashboardUrl: 'https://labs.example/social',
      })
    ).toThrow(/comment text or handles/);

    clearCapturedSocialEmails();
    const labsSend = jest.fn();
    await deliverDigest(
      {
        organizationId: 'org-a',
        to: ['owner@festival.test'],
        eventName: 'Harbourfest 2027',
        openBySeverity: { HIGH: 1 },
        openByTopic: { Safety: 0 },
        unansweredCount: 1,
        oldestUnansweredAge: '30 min',
        newYesterday: 1,
        handledYesterday: 0,
        topPost: { postedAt: '2026-07-14T18:00:00.000Z', platform: 'IG', reach: '9800' },
        dashboardUrl: 'https://labs.example/social',
      },
      { RAILWAY_ENVIRONMENT_NAME: 'labs', NODE_ENV: 'production' },
      { send: labsSend }
    );
    expect(labsSend).not.toHaveBeenCalled();
    expect(JSON.stringify(listCapturedSocialEmails('org-a'))).not.toContain('Doors');
    expect(socialMailShouldCapture({ NODE_ENV: 'production' })).toBe(false);
    expect(socialMailShouldCapture({ SOCIAL_EMAIL_CAPTURE: 'true' })).toBe(true);
  });

  it('uses the normal transport when capture is off and does not throw when that transport fails', async () => {
    const send = jest.fn().mockResolvedValue({ messageId: 'm1' });
    const sent = await deliverHighAlert(highInput, { NODE_ENV: 'production' }, { send });
    expect(sent.status).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
    expect(listCapturedSocialEmails('org-a')).toHaveLength(0);
    const logger = { warn: jest.fn() };
    send.mockRejectedValue(new Error('No production email provider is configured.'));
    const unsent = await deliverHighAlert(highInput, { NODE_ENV: 'production' }, { send, logger });
    expect(unsent.status).toBe('unsent');
    expect(logger.warn.mock.calls.join(' ')).not.toContain(COMMENT);
    expect(
      highAlertRecipients({
        assigneeEmail: 'Sam@Festival.test',
        ownerEmails: ['owner@festival.test'],
      })
    ).toEqual(['sam@festival.test', 'owner@festival.test']);
    expect(highAlertRecipients({ adminEmails: ['admin@festival.test'] })).toEqual([
      'admin@festival.test',
    ]);
  });

  it('returns classified JSON, including an empty label, and scopes the capture read to org admins', () => {
    const res = { json: jest.fn() };
    classifyComments(
      {
        body: {
          comments: [
            { id: 'a', text: 'someone was injured' },
            { id: 'b', text: 'hello there' },
          ],
        },
      } as AuthRequest,
      res as unknown as Response,
      jest.fn()
    );
    const payload = res.json.mock.calls[0][0].data.classifications;
    expect(payload[0]).toMatchObject({ commentId: 'a', topic: 'Safety', label: '' });
    expect(payload[1]).toMatchObject({ commentId: 'b', label: '' });
    expect(() =>
      requireCaptureReader({ role: 'TEAM_MEMBER', organizationId: 'org-a' }, true)
    ).toThrow(/Org admins/);
    expect(() => requireCaptureReader({ role: 'ADMIN', organizationId: 'org-a' }, false)).toThrow(
      /not enabled/
    );
    expect(requireCaptureReader({ role: 'OWNER', organizationId: 'org-a' }, true)).toBe('org-a');
    const previous = process.env.SOCIAL_COMMAND_CENTER_ENABLED;
    process.env.SOCIAL_COMMAND_CENTER_ENABLED = 'true';
    const captureResponse = { json: jest.fn() };
    const next = jest.fn();
    listEmailCaptures(
      { user: { userId: 'u', role: 'ADMIN', organizationId: 'org-b' } } as AuthRequest,
      captureResponse as unknown as Response,
      next
    );
    expect(captureResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { captures: [] } })
    );
    expect(listCapturedSocialEmails('org-b')).toEqual([]);
    expect(next).not.toHaveBeenCalled();
    if (previous === undefined) delete process.env.SOCIAL_COMMAND_CENTER_ENABLED;
    else process.env.SOCIAL_COMMAND_CENTER_ENABLED = previous;
  });
});
