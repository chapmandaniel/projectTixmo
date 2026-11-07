jest.mock('../../src/config/environment', () => ({
  config: {
    nodeEnv: 'test',
    corsRailwayProduction: false,
    allowLocalDevOrigins: true,
    trustClientUrlForCors: true,
    clientUrl: 'https://dashboard.example.com',
    corsOrigin: [
      'http://localhost:3001',
      'http://localhost:5173',
      'https://dash.example.com',
      'https://demo.tixmo.co',
    ],
  },
}));

import { config } from '../../src/config/environment';
import { isTrustedClientOrigin, resolveTrustedClientOrigin } from '../../src/utils/clientOrigin';

describe('client origin helpers', () => {
  const nodeEnv = config.nodeEnv;
  const corsRailwayProduction = config.corsRailwayProduction;

  afterEach(() => {
    (config as { nodeEnv: string }).nodeEnv = nodeEnv;
    (config as { corsRailwayProduction: boolean }).corsRailwayProduction = corsRailwayProduction;
  });

  it('accepts configured localhost origins', () => {
    expect(isTrustedClientOrigin('http://localhost:3001')).toBe(true);
  });

  it('accepts an allowlisted origin and strips a referer path', () => {
    expect(resolveTrustedClientOrigin('https://dash.example.com/approvals/abc?tab=reviewers')).toBe(
      'https://dash.example.com'
    );
  });

  it('accepts the snapshotted CLIENT_URL exactly', () => {
    expect(isTrustedClientOrigin('https://dashboard.example.com')).toBe(true);
    expect(isTrustedClientOrigin('http://dashboard.example.com')).toBe(false);
  });

  it('canonicalizes a configured production origin before matching', () => {
    expect(isTrustedClientOrigin('https://Demo.tixmo.co/')).toBe(true);
    expect(isTrustedClientOrigin('https://demo.tixmo.co:443')).toBe(true);
  });

  it('rejects a path, the literal null origin, and a non-default port', () => {
    expect(isTrustedClientOrigin('https://demo.tixmo.co/login')).toBe(false);
    expect(isTrustedClientOrigin('null')).toBe(false);
    expect(isTrustedClientOrigin('')).toBe(false);
    expect(isTrustedClientOrigin('https://demo.tixmo.co:444')).toBe(false);
    expect(isTrustedClientOrigin('https://user:pass@demo.tixmo.co')).toBe(false);
    expect(resolveTrustedClientOrigin('https://dash.example.com/approvals/abc?tab=reviewers')).toBe(
      'https://dash.example.com'
    );
    expect(resolveTrustedClientOrigin('null')).toBeUndefined();
  });

  it('rejects tixmo hosts that are not on the exact allowlist', () => {
    expect(isTrustedClientOrigin('https://mightyquinton.tixmo.co')).toBe(false);
    expect(isTrustedClientOrigin('https://labs.tixmo.co')).toBe(false);
    expect(
      resolveTrustedClientOrigin('https://mightyquinton.tixmo.co/approvals/abc?tab=reviewers')
    ).toBeUndefined();
  });

  it('rejects arbitrary Railway hosts', () => {
    expect(isTrustedClientOrigin('https://evil.up.railway.app')).toBe(false);
  });

  it('does not allow localhost or other loopback origins on a production deploy', () => {
    (config as { nodeEnv: string }).nodeEnv = 'production';

    expect(isTrustedClientOrigin('http://localhost:3001')).toBe(false);
    expect(isTrustedClientOrigin('http://localhost:8080')).toBe(false);
    expect(isTrustedClientOrigin('http://127.0.0.1:5173')).toBe(false);
    expect(isTrustedClientOrigin('http://[::1]:8080')).toBe(false);
    expect(isTrustedClientOrigin('https://dash.example.com')).toBe(true);
  });

  it('does not allow localhost when Railway marks the environment production', () => {
    (config as { corsRailwayProduction: boolean }).corsRailwayProduction = true;

    expect(isTrustedClientOrigin('http://localhost:5173')).toBe(false);
    expect(isTrustedClientOrigin('http://localhost:8080')).toBe(false);
    expect(isTrustedClientOrigin('https://dash.example.com')).toBe(true);
  });
});
