// Actual POSIX shell with owned inert command stubs; never app/npm/provider/DB code.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
const apiRoot = path.resolve(__dirname, '../..');
const script = path.join(apiRoot, 'scripts/start-api.sh');
function run(values: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-startup-'));
  const trace = path.join(dir, 'trace');
  const database = 'postgresql://synthetic:literal%20password@127.0.0.1:5432/disposable?application_name=literal value&x=$not_expanded';
  try {
    fs.writeFileSync(path.join(dir, 'npm'), `#!/bin/sh
set -eu
[ "$#" -eq 2 ] && [ "$1" = run ] && [ "$2" = migrate ] || exit 98
printf '%s\\n' migration >> "$TIXMO_START_TRACE"
exit "\${TIXMO_STUB_MIGRATION_EXIT:-0}"
`, { mode: 0o700 });
    fs.writeFileSync(path.join(dir, 'node'), `#!/bin/sh
set -eu
[ "$#" -eq 1 ] || exit 98
case "$1" in
  prisma/rekey-asset-shares.js)
    printf '%s\\n' asset-audit >> "$TIXMO_START_TRACE"
    [ "\${TIXMO_ASSET_REKEY_DATABASE_URL:-}" = "$TIXMO_EXPECTED_DATABASE" ] || exit 99
    exit "\${TIXMO_STUB_ASSET_EXIT:-0}" ;;
  scripts/stripe-read-probe.cjs)
    printf '%s\\n' stripe-read-probe >> "$TIXMO_START_TRACE"
    exit "\${TIXMO_STUB_STRIPE_EXIT:-0}" ;;
  dist/index.js)
    printf '%s\\n' server >> "$TIXMO_START_TRACE"
    printf '%s\\n' "$$" > "$TIXMO_SERVER_PID" ;;
  *) exit 98 ;;
esac
`, { mode: 0o700 });
    const result = spawnSync('/bin/sh', [script], {
      cwd: apiRoot,
      env: { PATH: dir, DATABASE_URL: database, TIXMO_EXPECTED_DATABASE: database, TIXMO_START_TRACE: trace, TIXMO_SERVER_PID: path.join(dir, 'server-pid'), ...values },
      encoding: 'utf8', timeout: 3000, maxBuffer: 16384,
    });
    const phases = result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const steps = fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8').trim().split('\n') : [];
    const serverPid = fs.existsSync(path.join(dir, 'server-pid')) ? Number(fs.readFileSync(path.join(dir, 'server-pid'), 'utf8')) : null;
    return { result, phases, steps, serverPid };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const markers = (phases: string[]) => phases.map(phase => ({ scope: 'api-startup', phase }));
it.each([
  {}, { TIXMO_ASSET_SHARE_AUDIT_ON_START: '', TIXMO_STRIPE_READ_PROBE: '' },
  { TIXMO_ASSET_SHARE_AUDIT_ON_START: 'TRUE', TIXMO_STRIPE_READ_PROBE: '1' },
  { TIXMO_ASSET_SHARE_AUDIT_ON_START: ' true', TIXMO_STRIPE_READ_PROBE: 'true ' },
])('default/missing/nonexact opt-ins execute only migration then server', values => {
  const { result, phases, steps, serverPid } = run(values);
  expect(result.status).toBe(0); expect(result.error).toBeUndefined(); expect(result.stderr).toBe('');
  expect(steps).toEqual(['migration', 'server']); expect(phases).toEqual(markers(steps));
  expect(serverPid).toBe(result.pid); // exec preserves the owned shell's PID for signals.
});
it.each([
  [{ TIXMO_ASSET_SHARE_AUDIT_ON_START: 'true' }, ['migration', 'asset-audit', 'server']],
  [{ TIXMO_STRIPE_READ_PROBE: 'true' }, ['migration', 'stripe-read-probe', 'server']],
  [{ TIXMO_ASSET_SHARE_AUDIT_ON_START: 'true', TIXMO_STRIPE_READ_PROBE: 'true' }, ['migration', 'asset-audit', 'stripe-read-probe', 'server']],
] as const)('exact opt-ins preserve operation order and quoted database propagation', (values, expected) => {
  const { result, phases, steps, serverPid } = run({ ...values, TIXMO_ASSET_REKEY_DATABASE_URL: 'must-be-overridden-by-current-runtime-database' });
  expect(result.status).toBe(0); expect(result.stderr).toBe('');
  expect(steps).toEqual(expected); expect(phases).toEqual(markers([...expected])); expect(serverPid).toBe(result.pid);
});
it.each([
  ['TIXMO_STUB_MIGRATION_EXIT', ['migration']],
  ['TIXMO_STUB_ASSET_EXIT', ['migration', 'asset-audit']],
  ['TIXMO_STUB_STRIPE_EXIT', ['migration', 'asset-audit', 'stripe-read-probe']],
] as const)('failure in %s prevents every later operation and API exec', (failure, expected) => {
  const { result, phases, steps, serverPid } = run({ TIXMO_ASSET_SHARE_AUDIT_ON_START: 'true', TIXMO_STRIPE_READ_PROBE: 'true', [failure]: '17' });
  expect(result.status).toBe(17); expect(result.stderr).toBe('');
  expect(steps).toEqual(expected); expect(phases).toEqual(markers([...expected])); expect(serverPid).toBeNull();
});
it('never includes runtime values in phase output and passes an absent DB as empty for CLI rejection', () => {
  const { result, phases } = run({ TIXMO_ASSET_SHARE_AUDIT_ON_START: 'true', DATABASE_URL: '', TIXMO_EXPECTED_DATABASE: '', STRIPE_SECRET_KEY: 'synthetic-key-canary' });
  expect(result.status).toBe(0); expect(phases).toEqual(markers(['migration', 'asset-audit', 'server']));
  expect(result.stdout).not.toMatch(/postgres|password|canary|not_expanded|DATABASE_URL/);
});
it('Docker and Railway invoke the same packaged script without nested startup shells', () => {
  const docker = fs.readFileSync(path.join(apiRoot, 'Dockerfile'), 'utf8');
  const railway = fs.readFileSync(path.join(apiRoot, 'railway.toml'), 'utf8');
  const source = fs.readFileSync(script, 'utf8');
  expect(docker).toContain('COPY scripts/stripe-read-probe.cjs scripts/start-api.sh ./scripts/');
  expect(docker).toContain('CMD ["sh", "scripts/start-api.sh"]');
  expect(railway).toContain('startCommand = "sh scripts/start-api.sh"');
  expect(source).toContain('set -eu'); expect(source).toContain('exec node dist/index.js');
  expect(source).not.toMatch(/eval|while |until |sleep|--apply|console|echo.*\$/);
});
