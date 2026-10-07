import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const runFile = promisify(execFile);
test('the status checker probes readiness and rejects a healthy-looking 200 with failed dependencies', async () => {
  let ready = true;
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push(req.url);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/ready' ? { status: ready ? 'ready' : 'not_ready', checks: { database: true, redis: ready } } : { status: 'ok' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, TIXMO_STATUS_RETRIES: '0', TIXMO_API_BASE_URL: `http://127.0.0.1:${server.address().port}`, TIXMO_DASHBOARD_URL: '', DASHBOARD_URL: '', TIXMO_STATUS_URLS: '' };
  const check = () => runFile(process.execPath, [fileURLToPath(new URL('./check-status.mjs', import.meta.url))], { env });
  try {
    const passed = await check();
    assert.match(passed.stdout, /ok .*\/ready/);
    assert.deepEqual(calls, ['/ready', '/health', '/api/v1/health']);
    ready = false;
    await assert.rejects(check, (error) => error.code === 1 && error.stderr.includes('/ready'));
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
