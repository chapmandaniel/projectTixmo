import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'src/scripts/seed-showpass.ts');
const compiled = path.join(root, 'dist/scripts/seed-showpass.js');

describe('compiled Showpass fixture seed', () => {
  it('connects Redis, prints no secrets, and exits 0', async () => {
    if (!existsSync(compiled) || statSync(compiled).mtimeMs < statSync(source).mtimeMs) {
      throw new Error('Fresh API build required before the Showpass seed smoke');
    }
    const dir = path.join(root, 'tmp/showpass-seed-smoke');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const scannerFile = path.join(dir, 'scanner.key');
    const webhookFile = path.join(dir, 'webhook.secret');
    const redisUrl = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379/1');
    const redisDb = redisUrl.pathname.replace(/^\//, '') || '0';
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn(process.execPath, [compiled], {
          cwd: root,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            SHOWPASS_ADAPTER: 'fixture',
            VENDOR_CREDENTIAL_KEY: 'cd'.repeat(32),
            JWT_SECRET: process.env.JWT_SECRET || 'seed-smoke-jwt-secret-value',
            JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'seed-smoke-refresh-secret-value',
            SESSION_SECRET: process.env.SESSION_SECRET || 'seed-smoke-session-secret-value',
            REDIS_DB: redisDb,
            SHOWPASS_QA_SCANNER_KEY_FILE: scannerFile,
            SHOWPASS_QA_WEBHOOK_SECRET_FILE: webhookFile,
          },
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
      }
    );

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain('Redis client not initialized');
    const scanner = readFileSync(scannerFile, 'utf8').trim();
    const webhook = readFileSync(webhookFile, 'utf8').trim();
    expect(scanner.startsWith('sk_scanner_')).toBe(true);
    expect(webhook.length).toBeGreaterThan(16);
    expect(result.stdout).not.toContain(scanner);
    expect(result.stdout).not.toContain(webhook);
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
    };
    expect(report.mode).toBe('fresh-org');
    expect(report.connected).toBe(false);
    expect(report.dublin).toBeNull();
    expect(report.collider?.slug).toBe('halloween-at-the-polygon-gallery');
  }, 40_000);
});
