#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { assertDisposableTestTarget } = require('./test-target.cjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const owned = [];
const docker = (args) => {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Disposable Docker operation failed. Start Docker Desktop or the project Colima profile.');
  return result.stdout.trim();
};
const run = (command, args, env, cwd = root) => {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(command + ' verification failed.');
};
const waitForPort = async (url, defaultPort) => {
  const target = new URL(url);
  for (let attempt = 0; attempt < 100; attempt++) {
    const ready = await new Promise((resolve) => {
      const socket = net.connect(Number(target.port) || defaultPort, target.hostname);
      socket.setTimeout(500);
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => { socket.destroy(); resolve(false); });
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
    });
    if (ready) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Disposable database service did not become ready.');
};

try {
  const env = { ...process.env, NODE_ENV: 'test' };
  // Never load application dotenv files or inherit real provider credentials for local gates.
  for (const key of Object.keys(env)) if (/^(AWS_|S3_|POSTMARK_|SMTP_|STRIPE_|SENTRY_)/.test(key)) delete env[key];
  env.PAYMENT_CURRENCY = 'cad';
  env.STRIPE_SECRET_KEY = 'sk_test_local_gate_mock';
  env.STRIPE_WEBHOOK_SECRET = 'whsec_local_gate_mock';
  env.JWT_SECRET = 'disposable_local_jwt_secret_32_characters';
  env.JWT_REFRESH_SECRET = 'disposable_local_refresh_secret_32_characters';
  env.SESSION_SECRET = 'disposable_local_session_secret_32_characters';
  if (!env.TIXMO_TEST_DATABASE_URL) {
    const suffix = randomUUID().slice(0, 8);
    const pg = 'tixmo-verify-pg-' + suffix;
    const redis = 'tixmo-verify-redis-' + suffix;
    const password = randomUUID();
    docker(['run', '--rm', '-d', '--name', pg, '-p', '127.0.0.1::5432', '-e', 'POSTGRES_USER=tixmo_test', '-e', 'POSTGRES_PASSWORD=' + password, '-e', 'POSTGRES_DB=tixmo_disposable_owned', 'postgres:17-alpine']);
    owned.push(pg);
    docker(['run', '--rm', '-d', '--name', redis, '-p', '127.0.0.1::6379', 'redis:7-alpine']);
    owned.push(redis);
    const pgPort = JSON.parse(docker(['inspect', pg]))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
    const redisPort = JSON.parse(docker(['inspect', redis]))[0].NetworkSettings.Ports['6379/tcp'][0].HostPort;
    env.TIXMO_TEST_DATABASE_URL = 'postgresql://tixmo_test:' + password + '@127.0.0.1:' + pgPort + '/tixmo_disposable_owned';
    env.TIXMO_TEST_REDIS_URL = 'redis://127.0.0.1:' + redisPort + '/1';
    env.TIXMO_ALLOW_TEST_RESET = 'true';
    env.DATABASE_URL = env.TIXMO_TEST_DATABASE_URL;
  }
  env.DATABASE_URL = assertDisposableTestTarget(env);
  if (!env.TIXMO_TEST_REDIS_URL || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(env.TIXMO_TEST_REDIS_URL).hostname)) throw new Error('An explicit loopback TIXMO_TEST_REDIS_URL is required.');
  env.REDIS_URL = env.TIXMO_TEST_REDIS_URL;
  env.TIXMO_ALLOW_DESTRUCTIVE_TESTS = '1';
  await waitForPort(env.DATABASE_URL, 5432);
  await waitForPort(env.REDIS_URL, 6379);
  process.stdout.write('[verify:api] Using authorized disposable loopback services. Connection credentials omitted.\n');
  run('node', ['--test', 'scripts/test-target.test.cjs'], env);
  run('npm', ['run', 'build'], env, path.join(root, 'tixmoapi2'));
  run('npm', ['run', 'migrate'], env, path.join(root, 'tixmoapi2'));
  run('node', ['--test', 'scripts/runtime-config-parser.test.mjs', 'scripts/waiting-room-redis.test.cjs', 'scripts/evidence-status.test.mjs', 'scripts/check-status.test.mjs'], env);
  run('npm', ['test', '--', '--runInBand'], env, path.join(root, 'tixmoapi2'));
  process.stdout.write('[verify:api] API verification passed.\n');
} catch (error) {
  process.stderr.write('[verify:api] ' + error.message + '\n');
  process.exitCode = 1;
} finally {
  for (const name of owned.reverse()) spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
}
