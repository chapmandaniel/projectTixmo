import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
const source = fs.readFileSync('docs/team/evidence/task-432/retained-shell.sh', 'utf8');
// Inject command functions INTO the subshell after sourcing the genuine helper.
// No service, real signal, /proc inspection or listener inspection occurs.
const mocks = `
owned_run=/nonexistent-task432-held-fixture; pgbin=/fixture
pg_pid=123; redis_pid=124; pgport=23001; redisport=43001; jest_attempted=0
alive() { return 1; }
owned_identity() { test "$1:$2" != "$foreign"; }
stop_exact() { printf 'STOP:%s:%s\\n' "$1" "$2"; owned_identity "$1" "$2"; }
ss() { case "$*" in *'23001 or'*) :;; *23001*) echo 'LISTEN 0 1 127.0.0.1:23001 users:((fixture,pid=123,fd=1))';; *43001*) echo 'LISTEN 0 1 127.0.0.1:43001 users:((fixture,pid=124,fd=1))';; esac; }
foreign=''; validation=1
alive() { test "$validation" = 1; }
# Switch alive to stopped after the held marker, allowing cleanup without tools.
printf() { if test "$1" = 'TASK432_SHELL_HELD\\n'; then validation=0; fi; builtin printf "$@"; }
`;
// PG cleanup's external pg_ctl must never execute: alive reports stopped when
// cleanup starts. Readiness still sees both held fake PIDs alive.
const injected = source.replace('  trap cleanup EXIT', mocks + '\n  trap cleanup EXIT');
const env = { PATH: '/usr/bin:/bin', PWD: process.cwd() };
const program = extra => injected + '\n' + extra + '\nretain_owned_shell\n';
function run(extra, input, status) {
  const r = spawnSync('bash', ['--noprofile', '--norc', '-c', program(extra)], { env, input, encoding: 'utf8', timeout: 3000 });
  assert.equal(r.status, status, r.stdout + r.stderr); return r.stdout + r.stderr;
}
// Override injected initial state by modifying the function's body for partials.
function partial(replacement, status) {
  const p = program('').replace('pg_pid=123; redis_pid=124;', replacement)
    .replace('validation=1', 'validation=0');
  const r = spawnSync('bash', ['--noprofile', '--norc', '-c', p], { env, input: '', encoding: 'utf8', timeout: 3000 });
  assert.equal(r.status, status, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /SHELL_HELD/); assert.match(r.stdout, /STOP:redis:/);
}
partial("pg_pid=''; redis_pid='';", 72);
partial("pg_pid=''; redis_pid=124;", 72);
// Foreign PG fails identity before held; cleanup refuses that foreign process.
const foreign = spawnSync('bash', ['--noprofile', '--norc', '-c', program('').replace("foreign='';", "foreign='pg:123';")], { env, input: '', encoding: 'utf8', timeout: 3000 });
assert.equal(foreign.status, 1, foreign.stdout + foreign.stderr);
assert.doesNotMatch(foreign.stdout, /SHELL_HELD/);
assert.match(foreign.stderr, /cleanup FAILED/);

assert.match(run('', 'close\nclose\n', 0), /SHELL_HELD/);
assert.equal((run('', 'close\n', 0).match(/STOP:redis:124/g) || []).length, 1);
run('', '', 74); run('', 'arbitrary-command\n', 74);
// Same shell remains blocked/alive until close; no polling sleep needed.
const child = spawn('bash', ['--noprofile', '--norc', '-c', program('')], { env, stdio: ['pipe', 'pipe', 'pipe'] });
let output = ''; let errors = ''; let held = false;
const deadline = setTimeout(() => { child.kill(); }, 3000);
child.stderr.on('data', b => { errors += b; });
child.stdout.on('data', b => {
  output += b;
  if (!held && output.includes('TASK432_SHELL_HELD\n')) {
    held = true; assert.equal(child.exitCode, null); assert.doesNotMatch(output, /CLEANUP|STOP:/);
    child.stdin.end('close\n');
  }
});
const status = await new Promise(resolve => child.on('close', resolve));
clearTimeout(deadline);
assert.equal(status, 0, output + errors); assert.equal(held, true);
assert.equal((output.match(/TASK379_CLEANUP/g) || []).length, 1);
// Default runtime and acquisition remain unavailable, no new provider installed.
const denied = spawnSync('bash', ['docs/team/evidence/task-427/runtime.sh'], { env, encoding: 'utf8' });
assert.equal(denied.status, 2); assert.match(denied.stderr, /source-only handoff/);
console.log('PASS inert held lifetime, close once, EOF/unknown denial, partial-start cleanup/original72, missing grant');

const observerFailProgram = program('').replace("*'23001 or'*) :;", "*'23001 or'*) return 23;");
const observerFail = spawnSync('bash', ['--noprofile', '--norc', '-c', observerFailProgram], { env, input: 'close\n', encoding: 'utf8', timeout: 3000 });
assert.equal(observerFail.status, 1, observerFail.stdout + observerFail.stderr);
assert.match(observerFail.stdout, /TASK432_SHELL_HELD/);
assert.doesNotMatch(observerFail.stdout, /TASK379_CLEANUP/);
assert.match(observerFail.stderr, /listener observation FAILED status=23/);
console.log('PASS readiness succeeds then cleanup observer23 denies success/nonzero with phase and status');
