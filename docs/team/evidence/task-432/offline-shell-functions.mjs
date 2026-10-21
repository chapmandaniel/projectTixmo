import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
const runtime = fs.readFileSync('docs/team/evidence/task-427/runtime.sh', 'utf8');
const helper = fs.readFileSync('docs/team/evidence/task-427/owned-lifecycle.sh', 'utf8');
const definitions = helper.slice(helper.indexOf('alive() {'));
const old = execFileSync('git', ['show', 'd5fec56e99a37218ef06a512e265c99942290340:docs/team/evidence/task-427/runtime.sh'], { encoding: 'utf8' });
assert.equal(runtime.replace('source "$PWD/docs/team/evidence/task-427/owned-lifecycle.sh"\n', () => definitions), old);
const source = 'source "$PWD/docs/team/evidence/task-427/owned-lifecycle.sh"\n';
function bash(body, expected = 0) {
  const r = spawnSync('bash', ['--noprofile', '--norc', '-c', source + body], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', PWD: process.cwd() } });
  assert.equal(r.status, expected, r.stderr + r.stdout); return r.stdout + r.stderr;
}
// Source itself has no command/process effects or traps.
assert.equal(bash('declare -F alive owned_identity stop_exact cleanup; trap -p'), 'alive\nowned_identity\nstop_exact\ncleanup\n');
const mocks = `
stat() { printf '1000\\n'; }; id() { printf '1000\\n'; }
ps() { printf '%s\\n' "$$"; }
readlink() { case "$2" in /proc/*) printf '%s\\n' "$observed";; *) printf '%s\\n' "$2";; esac; }
runtime_root=/fixture; redis_pid=123; observed=/fixture/usr/bin/redis-server
`;
bash(mocks + 'owned_identity redis 123');
bash(mocks + 'owned_identity redis 124', 1); // foreign PID, even same UID
bash(mocks + 'observed=/foreign/redis; owned_identity redis 123', 1);
bash(mocks + "stat() { printf '999\\n'; }; owned_identity redis 123", 1);
// A live foreign identity must never receive a signal. Both commands are inert.
bash('alive() { return 0; }; owned_identity() { return 1; }; kill() { echo UNEXPECTED; }; stop_exact redis 123', 1);
const clean = `
owned_run=/nonexistent-task432-offline; pgbin=/fixture; pg_pid=''; redis_pid=''; jest_attempted=0; pgport=23001; redisport=43001
stop_exact() { printf 'STOP:%s:%s\\n' "$1" "$2"; }
ss() { :; }
`;
assert.match(bash(clean + '(exit 7); cleanup', 7), /STOP:redis:/); // partial startup/no PIDs retains failure
assert.match(bash(clean + 'redis_pid=123; alive() { return 1; }; wait() { :; }; (exit 9); cleanup', 9), /STOP:redis:123/);
bash(clean + "ss() { printf 'foreign listener\\n'; }; cleanup", 1); // cannot claim cleanup with listener
assert.match(bash(clean + 'stop_exact() { return 1; }; cleanup', 1), /cleanup FAILED/);
console.log('PASS exact byte reconstruction; inert source; owned/foreign PID, UID and executable; no foreign signal; partial startup status; foreign listener and cleanup failure denial');
