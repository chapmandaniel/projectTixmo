import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const apiRoot = path.join(repoRoot, 'tixmoapi2');

const log = (message) => process.stdout.write(`[verify:api] ${message}\n`);
const fail = (message, extra = '') => {
  process.stderr.write(`[verify:api] ${message}\n`);
  if (extra) {
    process.stderr.write(`${extra}\n`);
  }
  process.exit(1);
};

const run = (command, args, options = {}) => {
  const { capture = false, ...spawnOptions } = options;
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    shell: false,
    ...spawnOptions,
  });

  return result;
};

const runShell = (command, options = {}) => {
  const { capture = false, ...spawnOptions } = options;
  return spawnSync(command, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    shell: true,
    ...spawnOptions,
  });
};

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).reduce((env, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return env;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return env;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
    return env;
  }, {});
};

const envFile = parseEnvFile(path.join(apiRoot, '.env'));
for (const [key, value] of Object.entries(envFile)) {
  process.env[key] ||= value;
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://tixmo:tixmo_dev_password@localhost:5432/tixmoapi?schema=public';
process.env.REDIS_URL ||= 'redis://localhost:6379';

const isPlaceholderCredential = (value) => {
  const lowerValue = String(value || '').trim().toLowerCase();
  return (
    !lowerValue ||
    lowerValue.includes('your_') ||
    lowerValue.includes('_your') ||
    lowerValue.includes('change-this') ||
    lowerValue.includes('placeholder')
  );
};

const setTestCredential = (key, value) => {
  if (isPlaceholderCredential(process.env[key])) {
    process.env[key] = value;
  }
};

setTestCredential('STRIPE_SECRET_KEY', 'sk_test_verify_api');
setTestCredential('STRIPE_PUBLISHABLE_KEY', 'pk_test_verify_api');
setTestCredential('STRIPE_WEBHOOK_SECRET', 'whsec_verify_api');

const redactDatabaseUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '<invalid DATABASE_URL>';
  }
};

const getHostPort = (value, fallbackPort) => {
  try {
    const url = new URL(value);
    return {
      host: url.hostname || 'localhost',
      port: Number(url.port || fallbackPort),
    };
  } catch {
    return { host: 'localhost', port: fallbackPort };
  }
};

const waitForPort = ({ host, port, label }, timeoutMs = 45000) => new Promise((resolve, reject) => {
  const startedAt = Date.now();

  const attempt = () => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(1500);

    socket.on('connect', () => {
      socket.destroy();
      resolve();
    });

    const retry = () => {
      socket.destroy();
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`${label} did not become reachable at ${host}:${port}`));
        return;
      }
      setTimeout(attempt, 1000);
    };

    socket.on('timeout', retry);
    socket.on('error', retry);
  };

  attempt();
});

const tailColimaLog = () => {
  const logPath = path.join(process.env.HOME || '', '.colima/_lima/colima/ha.stderr.log');
  if (!fs.existsSync(logPath)) {
    return '';
  }

  return fs.readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-20).join('\n');
};

log(`DATABASE_URL ${redactDatabaseUrl(process.env.DATABASE_URL)}`);
log(`REDIS_URL ${process.env.REDIS_URL}`);

let dockerInfo = run('docker', ['info'], { capture: true });
if (dockerInfo.status !== 0) {
  const dockerContext = run('docker', ['context', 'show'], { capture: true });
  const activeContext = dockerContext.status === 0 ? dockerContext.stdout.trim() : '';

  if (activeContext === 'colima') {
    log('Docker uses the colima context and Docker is unavailable; attempting `colima start`.');
    const colimaStart = run('colima', ['start'], { capture: true });
    if (colimaStart.status !== 0) {
      fail(
        'Unable to start Colima. Repair Colima or switch Docker contexts before running API verification.',
        `${colimaStart.stdout || ''}${colimaStart.stderr || ''}\nRecent Colima log:\n${tailColimaLog()}`
      );
    }
  }

  dockerInfo = run('docker', ['info'], { capture: true });
  if (dockerInfo.status !== 0) {
    fail('Docker is unavailable. Start Docker Desktop or Colima before running API verification.', dockerInfo.stderr);
  }
}

log('Starting Postgres and Redis via Docker Compose.');
const composeResult = runShell('docker compose -f tixmoapi2/docker-compose.yml up -d', { capture: true });
if (composeResult.status !== 0) {
  const legacyComposeResult = runShell('docker-compose -f tixmoapi2/docker-compose.yml up -d', { capture: true });
  if (legacyComposeResult.status !== 0) {
    fail('Failed to start Docker Compose services.', `${composeResult.stderr}\n${legacyComposeResult.stderr}`);
  }
}

const database = getHostPort(process.env.DATABASE_URL, 5432);
const redis = getHostPort(process.env.REDIS_URL, 6379);

try {
  await waitForPort({ ...database, label: 'Postgres' });
  await waitForPort({ ...redis, label: 'Redis' });
} catch (error) {
  fail((error instanceof Error ? error.message : String(error)));
}

log('Applying Prisma schema to the test database.');
const dbPush = run('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], {
  cwd: apiRoot,
});
if (dbPush.status !== 0) {
  fail('Prisma db push failed.');
}

log('Running API tests.');
const testResult = run('npm', ['--prefix', 'tixmoapi2', 'test', '--', '--runInBand']);
if (testResult.status !== 0) {
  fail('API tests failed.');
}

log('API verification passed.');
