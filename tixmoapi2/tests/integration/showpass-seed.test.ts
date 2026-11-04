import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'src/scripts/seed-showpass.ts');
const compiled = path.join(root, 'dist/scripts/seed-showpass.js');

const runSeed = (
  env: NodeJS.ProcessEnv
): Promise<{ code: number | null; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [compiled], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Showpass seed did not exit'));
    }, 30_000);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

describe('compiled Showpass fixture seed', () => {
  const baseEnv = (): NodeJS.ProcessEnv => {
    const redisUrl = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379/1');
    const redisDb = redisUrl.pathname.replace(/^\//, '') || '0';
    return {
      ...process.env,
      NODE_ENV: 'test',
      APP_ENV: 'test',
      RAILWAY_ENVIRONMENT_NAME: '',
      SHOWPASS_SEED_ALLOW: 'sandbox',
      SHOWPASS_ADAPTER: 'fixture',
      VENDOR_CREDENTIAL_KEY: 'cd'.repeat(32),
      JWT_SECRET: process.env.JWT_SECRET || 'seed-smoke-jwt-secret-value',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'seed-smoke-refresh-secret-value',
      SESSION_SECRET: process.env.SESSION_SECRET || 'seed-smoke-session-secret-value',
      REDIS_DB: redisDb,
    };
  };

  beforeAll(() => {
    if (!existsSync(compiled) || statSync(compiled).mtimeMs < statSync(source).mtimeMs) {
      throw new Error('Fresh API build required before the Showpass seed smoke');
    }
  });

  it('connects Redis, writes a 0600 password file, and exits 0', async () => {
    const dir = path.join(root, 'tmp/showpass-seed-smoke');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const scannerFile = path.join(dir, 'scanner.key');
    const webhookFile = path.join(dir, 'webhook.secret');
    const passwordFile = path.join(dir, 'organizer.password');
    const result = await runSeed({
      ...baseEnv(),
      SHOWPASS_QA_SCANNER_KEY_FILE: scannerFile,
      SHOWPASS_QA_WEBHOOK_SECRET_FILE: webhookFile,
      SHOWPASS_QA_PASSWORD_FILE: passwordFile,
    });

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain('Redis client not initialized');
    const scanner = readFileSync(scannerFile, 'utf8').trim();
    const webhook = readFileSync(webhookFile, 'utf8').trim();
    expect(scanner.startsWith('sk_scanner_')).toBe(true);
    expect(webhook.length).toBeGreaterThan(16);
    expect(result.stdout).not.toContain(scanner);
    expect(result.stdout).not.toContain(webhook);
    expect(result.stdout).not.toContain('FixtureOrganizer1!');
    const password = readFileSync(passwordFile, 'utf8').trim();
    expect(password.length).toBeGreaterThanOrEqual(12);
    expect(statSync(passwordFile).mode & 0o777).toBe(0o600);
    expect(result.stdout).not.toContain(password);
    expect(result.stderr).not.toContain(password);
    const reportLine = result.stdout
      .trim()
      .split('\n')
      .reverse()
      .find((line) => line.startsWith('{'));
    const report = JSON.parse(reportLine || '{}') as {
      mode?: string;
      connected?: boolean;
      collider?: { slug?: string };
      dublin?: { id?: string } | null;
      events?: unknown[];
      fixtures?: Array<{
        fixtureId?: string;
        counts?: Array<{ soldCount: number | null }>;
      }>;
    };
    expect(report.mode).toBe('fresh-org');
    expect(report.connected).toBe(false);
    expect(report.dublin).toBeNull();
    expect(report.events).toEqual([]);
    expect(report.collider?.slug).toBe('halloween-at-the-polygon-gallery');
    const dublinFixture = report.fixtures?.find((row) => row.fixtureId === 'sp-evt-1545631');
    expect(dublinFixture?.counts?.some((row) => typeof row.soldCount === 'number')).toBe(true);
    const giants = report.fixtures?.find((row) => row.fixtureId === 'sp-evt-1530323');
    expect(giants?.counts?.length).toBeGreaterThan(0);
    expect(giants?.counts?.every((row) => row.soldCount === null)).toBe(true);
  }, 40_000);

  it('refuses production and a non-sandbox Railway environment', async () => {
    const missingFlag = await runSeed({ ...baseEnv(), SHOWPASS_SEED_ALLOW: '' });
    expect(missingFlag.code).not.toBe(0);
    expect(missingFlag.stderr).toContain('SHOWPASS_SEED_ALLOW=sandbox');

    const production = await runSeed({ ...baseEnv(), NODE_ENV: 'production' });
    expect(production.code).not.toBe(0);
    expect(production.stderr).toContain('production');
    expect(production.stdout).not.toContain('FixtureOrganizer1!');

    const railway = await runSeed({ ...baseEnv(), RAILWAY_ENVIRONMENT_NAME: 'production' });
    expect(railway.code).not.toBe(0);
    expect(railway.stderr).toContain('Railway environment');

    const prefixed = await runSeed({
      ...baseEnv(),
      NODE_ENV: 'development',
      SHOWPASS_SEED_ALLOW: 'sandbox',
      RAILWAY_ENVIRONMENT_NAME: 'vendor-sandbox-prod',
    });
    expect(prefixed.code).not.toBe(0);
    expect(prefixed.stderr).toContain('Railway environment');

    for (const name of ['labs-prod', 'prod-labs', 'production']) {
      const refused = await runSeed({
        ...baseEnv(),
        NODE_ENV: 'development',
        SHOWPASS_SEED_ALLOW: 'sandbox',
        RAILWAY_ENVIRONMENT_NAME: name,
      });
      expect(refused.code).not.toBe(0);
      expect(refused.stderr).toContain('Railway environment');
    }

    const appProduction = await runSeed({
      ...baseEnv(),
      NODE_ENV: 'development',
      APP_ENV: 'production',
      SHOWPASS_SEED_ALLOW: 'sandbox',
      RAILWAY_ENVIRONMENT_NAME: 'vendor-sandbox',
    });
    expect(appProduction.code).not.toBe(0);
    expect(appProduction.stderr).toContain('production');

    const imageNodeEnv = await runSeed({
      ...baseEnv(),
      NODE_ENV: 'production',
      SHOWPASS_SEED_ALLOW: 'sandbox',
      RAILWAY_ENVIRONMENT_NAME: 'vendor-sandbox',
    });
    expect(imageNodeEnv.code).not.toBe(0);
    expect(imageNodeEnv.stderr).toContain('production');
  }, 40_000);

  it('accepts the vendor-sandbox Railway name with NODE_ENV=development', async () => {
    const dir = path.join(root, 'tmp/showpass-seed-vendor-sandbox');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const passwordFile = path.join(dir, 'organizer.password');
    const result = await runSeed({
      ...baseEnv(),
      NODE_ENV: 'development',
      APP_ENV: 'test',
      SHOWPASS_SEED_ALLOW: 'sandbox',
      RAILWAY_ENVIRONMENT_NAME: 'vendor-sandbox',
      SHOWPASS_QA_SCANNER_KEY_FILE: path.join(dir, 'scanner.key'),
      SHOWPASS_QA_WEBHOOK_SECRET_FILE: path.join(dir, 'webhook.secret'),
      SHOWPASS_QA_PASSWORD_FILE: passwordFile,
    });
    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain('Railway environment');
    const password = readFileSync(passwordFile, 'utf8').trim();
    expect(result.stdout).not.toContain(password);
    const reportLine = result.stdout
      .trim()
      .split('\n')
      .reverse()
      .find((line) => line.startsWith('{'));
    const report = JSON.parse(reportLine || '{}') as { mode?: string };
    expect(report.mode).toBe('fresh-org');
  }, 40_000);

  it('accepts the labs Railway name with NODE_ENV=development', async () => {
    const dir = path.join(root, 'tmp/showpass-seed-labs');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const passwordFile = path.join(dir, 'organizer.password');
    const result = await runSeed({
      ...baseEnv(),
      NODE_ENV: 'development',
      APP_ENV: 'test',
      SHOWPASS_SEED_ALLOW: 'sandbox',
      RAILWAY_ENVIRONMENT_NAME: 'labs',
      SHOWPASS_QA_SCANNER_KEY_FILE: path.join(dir, 'scanner.key'),
      SHOWPASS_QA_WEBHOOK_SECRET_FILE: path.join(dir, 'webhook.secret'),
      SHOWPASS_QA_PASSWORD_FILE: passwordFile,
    });
    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain('Railway environment');
    const password = readFileSync(passwordFile, 'utf8').trim();
    expect(result.stdout).not.toContain(password);
    const reportLine = result.stdout
      .trim()
      .split('\n')
      .reverse()
      .find((line) => line.startsWith('{'));
    const report = JSON.parse(reportLine || '{}') as { mode?: string };
    expect(report.mode).toBe('fresh-org');
  }, 40_000);
});
