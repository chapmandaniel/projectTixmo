import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = resolve(root, 'docker-compose.brand-protection.yml');
const databaseUrl =
  'postgresql://tixmo:tixmo_local_only@127.0.0.1:54329/tixmo_disposable_brandcheck?schema=public';
const secretsPath = resolve(root, 'tixmoapi2/.env.brand-protection.local');
const checkerEnvPath = resolve(root, 'brand-checker/.env');
const checkerLocal = resolve(root, 'brand-checker/.local');
const tokenPath = resolve(checkerLocal, 'checker-token');
const watchlistPath = resolve(checkerLocal, 'watchlist.json');
const dashEnvPath = resolve(root, 'tdash/.env.development.local');

const BLOCKED = ['railway', 'amazonaws', 'neon.tech', 'supabase.co', 'render.com', 'azure.com'];

function assertLocalDatabase(raw) {
  const url = new URL(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('Brand protection local setup only accepts a loopback Postgres URL');
  }
  if (url.pathname !== '/tixmo_disposable_brandcheck') {
    throw new Error('Brand protection local setup only uses tixmo_disposable_brandcheck');
  }
  const lowered = raw.toLowerCase();
  for (const marker of BLOCKED) {
    if (lowered.includes(marker)) throw new Error('Refusing a hosted database URL');
  }
}

function run(command, args, env, cwd = root) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`));
    });
  });
}

function readSecrets() {
  if (!existsSync(secretsPath)) {
    const generated = [
      `JWT_SECRET=${randomBytes(32).toString('base64url')}`,
      `JWT_REFRESH_SECRET=${randomBytes(32).toString('base64url')}`,
      `SESSION_SECRET=${randomBytes(32).toString('base64url')}`,
      '',
    ].join('\n');
    mkdirSync(dirname(secretsPath), { recursive: true });
    writeFileSync(secretsPath, generated, { mode: 0o600 });
  }
  const values = {};
  for (const line of readFileSync(secretsPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    values[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET']) {
    if (!values[key] || values[key].length < 16) throw new Error(`${key} is missing from the local secrets file`);
  }
  return values;
}

function apiEnv(secrets) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'development',
    PORT: '3000',
    API_VERSION: 'v1',
    DATABASE_URL: databaseUrl,
    JWT_SECRET: secrets.JWT_SECRET,
    JWT_REFRESH_SECRET: secrets.JWT_REFRESH_SECRET,
    SESSION_SECRET: secrets.SESSION_SECRET,
    FEATURE_GIVEAWAY_PROTECTION: 'true',
    CLIENT_URL: 'http://127.0.0.1:5173',
    CORS_ORIGIN: 'http://127.0.0.1:5173,http://localhost:5173',
    REDIS_URL: 'redis://127.0.0.1:6399',
  };
}

async function ensureDeps() {
  const jobs = [];
  if (!existsSync(resolve(root, 'tixmoapi2/node_modules'))) {
    jobs.push(run('npm', ['ci', '--prefix', 'tixmoapi2'], process.env));
  }
  if (!existsSync(resolve(root, 'tdash/node_modules'))) {
    jobs.push(run('npm', ['ci', '--prefix', 'tdash'], process.env));
  }
  if (!existsSync(resolve(root, 'brand-checker/node_modules'))) {
    jobs.push(run('npm', ['ci', '--prefix', 'brand-checker'], process.env));
  }
  await Promise.all(jobs);
}

async function waitForHttp(url, label) {
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process is still binding the port.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

async function prepare() {
  assertLocalDatabase(databaseUrl);
  if ((process.env.DATABASE_URL || '').toLowerCase().includes('railway')) {
    throw new Error('Refusing to start while DATABASE_URL points at Railway. Unset it and run this again.');
  }
  await ensureDeps();
  await run('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait'], process.env);
  const secrets = readSecrets();
  const env = apiEnv(secrets);
  await run('npx', ['prisma', 'generate'], env, resolve(root, 'tixmoapi2'));
  await run('npx', ['prisma', 'migrate', 'deploy'], env, resolve(root, 'tixmoapi2'));
  mkdirSync(checkerLocal, { recursive: true });
  await run(
    'node',
    ['scripts/seed-brand-protection-local.mjs'],
    {
      ...env,
      BRAND_REPO_ROOT: root,
      BRAND_WATCHLIST_PATH: watchlistPath,
      BRAND_TOKEN_FILE: tokenPath,
    },
    resolve(root, 'tixmoapi2')
  );
  const token = readFileSync(tokenPath, 'utf8').trim();
  if (!token.startsWith('gwc_')) throw new Error('Seed did not write a local checker token');
  const checkerEnv = [
    'TIXMO_API_URL=http://127.0.0.1:3000',
    `TIXMO_CHECKER_TOKEN=${token}`,
    'TIXMO_WATCHLIST_PATH=.local/watchlist.json',
    'CHECKER_CONTACT_URL=http://127.0.0.1:5173/brand-protection',
    'CRTSH_CACHE_PATH=.cache/crtsh.json',
    'BRAND_CHECKER_REPORT=.local/last-run.json',
    '',
  ].join('\n');
  writeFileSync(checkerEnvPath, checkerEnv, { mode: 0o600 });
  writeFileSync(
    dashEnvPath,
    'VITE_API_URL=/api/v1\nVITE_FEATURE_GIVEAWAY_PROTECTION=true\n',
    { mode: 0o600 }
  );
  return env;
}

async function main() {
  const prepareOnly = process.argv.includes('--prepare');
  const env = await prepare();
  if (prepareOnly) {
    process.stdout.write('Local database is ready. API and dashboard were not started.\n');
    return;
  }
  const api = spawn(
    'node',
    ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'src/index.ts'],
    {
      cwd: resolve(root, 'tixmoapi2'),
      env: { ...env, TS_NODE_TRANSPILE_ONLY: 'true' },
      stdio: 'inherit',
    }
  );
  const dash = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: resolve(root, 'tdash'),
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      VITE_API_URL: '/api/v1',
      VITE_FEATURE_GIVEAWAY_PROTECTION: 'true',
    },
    stdio: 'inherit',
  });
  const shutdown = () => {
    api.kill('SIGTERM');
    dash.kill('SIGTERM');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await waitForHttp('http://127.0.0.1:3000/health', 'API');
  await waitForHttp('http://127.0.0.1:5173', 'Dashboard');
  process.stdout.write(
    [
      '',
      'Brand protection is running locally.',
      'API: http://127.0.0.1:3000',
      'Dashboard: http://127.0.0.1:5173',
      'Log in as harbourfest.owner@localhost.test / LocalHarbour-1!',
      'The checker token was printed above and saved in brand-checker/.env.',
      'In another terminal, from the repo root: npm run brand:check',
      'Ctrl+C stops the API and dashboard. Postgres keeps the local data.',
      'Stop Postgres with: npm run brand:local:down',
      '',
    ].join('\n')
  );
  await new Promise((resolvePromise) => {
    api.on('exit', resolvePromise);
    dash.on('exit', resolvePromise);
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Local setup failed';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
