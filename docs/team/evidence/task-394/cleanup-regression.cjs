'use strict';
// Independent source-only observer harness. All filesystem and ss observations
// inside the candidate observer are stubs; no services or network operations.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../task-393/process-cleanup.cjs'), 'utf8');
const identity = {pid: 654321, ppid: 1, executable: '/usr/bin/node', startStat: 'old-run-start-identity'};
const listener = { ...identity, address: {address: '127.0.0.1', family: 'IPv4', port: 51001}};
function run(name, options, expected) {
  let output;
  const proc = {argv: ['node', 'observer', '/stub/run.OLD'], exitCode: 0};
  const fakeFs = {
    readFileSync(file) {
      if (options.missing) throw new Error('ENOENT');
      if (options.invalidJson) return '{';
      return JSON.stringify(file.endsWith('jest-identity.json') ? options.identity ?? identity : options.listener ?? listener);
    },
    existsSync: () => !!options.pidPresent,
    writeFileSync: (_file, value) => {output = JSON.parse(value);},
  };
  vm.runInNewContext(source, {process: proc, console: {log() {}}, require(name) {
    if (name === 'node:fs') return fakeFs;
    if (name === 'node:path') return path;
    if (name === 'node:child_process') return {spawnSync: () => ({status: options.ssStatus ?? 0, stdout: options.occupied ? 'LISTEN occupied' : ''})};
    if (name === '../task-379/runtime-path.cjs') return {validate() {}};
    throw new Error('Unexpected dependency ' + name);
  }});
  assert.equal(proc.exitCode, expected, name);
  console.log(`${name}: exit=${proc.exitCode}, errors=${JSON.stringify(output.errors)}`);
}
run('missing receipt rejected', {missing:true}, 1);
run('invalid JSON rejected', {invalidJson:true}, 1);
run('invalid PID rejected', {identity:{pid:0}}, 1);
run('present PID including reuse conservatively rejected', {pidPresent:true}, 1);
run('occupied port rejected', {occupied:true}, 1);
run('ss failure rejected', {ssStatus:1}, 1);
run('STALE old-run receipts ACCEPTED (finding)', {}, 0);
run('MALFORMED missing startStat/executable/ppid ACCEPTED (finding)', {identity:{pid:654321}}, 0);
run('MISMATCHED start identities across receipts ACCEPTED (finding)', {listener:{...listener,startStat:'different-start',executable:'/other/node',ppid:999}}, 0);
run('MALFORMED IPv6 family receipt ACCEPTED (finding)', {listener:{pid:654321,address:{address:'127.0.0.1',family:'IPv6',port:51001}}}, 0);
