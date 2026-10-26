import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { cleanupTestData } from '../utils/testUtils';

const root = path.resolve(__dirname, '../..');
const repo = path.resolve(root, '..');
const task = path.join(root, 'scripts/run-task.cjs');
const { inventoryEnv } = require('../../scripts/run-task.cjs');

function summary(stdout: string) {
  const lines = stdout.trim().split('\n');
  return JSON.parse(lines[lines.length - 1] || '');
}

function spawnTask(args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [task, ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
}

beforeEach(cleanupTestData);

it('uses DATABASE_URL without changing the caller environment', () => {
  const env = { DATABASE_URL: 'postgresql://127.0.0.1:54329/tixmo_disposable_task?schema=public' };
  const next = inventoryEnv(env);
  expect(env).not.toHaveProperty('TIXMO_INVENTORY_DATABASE_URL');
  expect(next.TIXMO_INVENTORY_DATABASE_URL).toBe(env.DATABASE_URL);
});

it('rejects an unknown task and an apply without the writer flags', () => {
  const unknown = spawnTask(['missing-task'], { PATH: process.env.PATH });
  expect(unknown.status).toBe(1);
  expect(summary(unknown.stdout)).toMatchObject({ task: 'missing-task', ok: false });
  expect(unknown.stdout).not.toContain('dist/index');

  const env = { ...process.env };
  delete env.TIXMO_INVENTORY_DATABASE_URL;
  delete env.TIXMO_ALLOW_INVENTORY_RECONCILIATION;
  delete env.TIXMO_INVENTORY_WRITERS_QUIESCED;
  const apply = spawnTask(['inventory-reconcile-apply'], env);
  expect(apply.status).toBe(1);
  expect(summary(apply.stdout)).toEqual({
    task: 'inventory-reconcile-apply',
    ok: false,
    error:
      'Apply requires TIXMO_ALLOW_INVENTORY_RECONCILIATION=true and TIXMO_INVENTORY_WRITERS_QUIESCED=true.',
  });
  expect(apply.stdout + apply.stderr).not.toContain(String(process.env.DATABASE_URL));
});

it('dry-runs from DATABASE_URL and does not start the server', () => {
  const startup = fs.readFileSync(path.join(root, 'scripts/start-api.sh'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
  const source = fs.readFileSync(task, 'utf8');
  expect(startup).not.toContain('run-task');
  expect(startup).not.toContain('inventory-reconcile');
  expect(server).not.toContain('run-task');
  expect(server).not.toContain('inventory-reconcile');
  expect(source).not.toMatch(/dist\/index|src\/index|\.listen\(/);
  expect(fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8')).toContain(
    'COPY scripts/run-task.cjs ./scripts/run-task.cjs'
  );
  expect(fs.readFileSync(path.join(root, 'railway.toml'), 'utf8')).toContain(
    'startCommand = "/bin/sh scripts/start-api.sh"'
  );

  const env = { ...process.env };
  delete env.TIXMO_INVENTORY_DATABASE_URL;
  const ran = spawnSync('npm', ['run', 'task', '--', 'inventory-reconcile-dry-run'], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  expect(ran.status).toBe(0);
  expect(summary(ran.stdout)).toEqual({
    task: 'inventory-reconcile-dry-run',
    ok: true,
    changed: 0,
    writes: false,
  });
  expect(ran.stdout).toContain('"mode": "dry-run"');
  expect(ran.stdout).toContain('"resolveUnknown": true');
  expect(ran.stdout).toContain('"upcomingOnly": true');
  expect(ran.stdout + ran.stderr).not.toContain(String(process.env.DATABASE_URL));
}, 60000);

it('documents the temporary Railway start command and the revert', () => {
  const doc = fs.readFileSync(path.join(repo, 'docs/DB_BACKUP_AND_MIGRATION_ROLLBACK.md'), 'utf8');
  expect(doc).toContain('npm run task -- inventory-reconcile-dry-run');
  expect(doc).toContain('npm run task -- inventory-reconcile-apply');
  expect(doc).toContain('/bin/sh scripts/start-api.sh');
});
