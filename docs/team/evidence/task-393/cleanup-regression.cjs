'use strict';
// All observations stubbed: no /proc reads, ss execution, sockets or signals.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, 'process-cleanup.cjs'), 'utf8');
const root = '/stub/run.CURRENT';
const runId = 'a'.repeat(64);
const fields = Array(49).fill('0'); fields[0] = '12'; fields[18] = '345';
const identity = {pid:123456, ppid:12, executable:'/usr/bin/node', startStat:`123456 (node (worker)) S ${fields.join(' ')}\n`, runId, runtimeRoot:root};
const listener = {...identity, address:{address:'127.0.0.1',family:'IPv4',port:51001}};
let total = 0;
function run(name, options = {}, expected = 1) {
  let report, observations = 0;
  const proc = {argv:['node','observer',root],execPath:'/usr/bin/node',env:{TASK379_RUN_ID:runId},exitCode:0};
  if (options.env !== undefined) proc.env = options.env;
  vm.runInNewContext(source, {process:proc, console:{log(){}}, require(name) {
    if (name === 'node:path') return path;
    if (name === '../task-379/runtime-path.cjs') return {validate(){}};
    if (name === 'node:fs') return {
      readFileSync(file) {
        if (options.missing === path.basename(file)) throw Error('ENOENT');
        if (options.invalidJson) return '{';
        return JSON.stringify(file.endsWith('jest-identity.json') ? Object.hasOwn(options,'identity') ? options.identity : identity : Object.hasOwn(options,'listener') ? options.listener : listener);
      },
      existsSync(){return !!options.present;},
      writeFileSync(_file, contents){report=JSON.parse(contents);},
    };
    if (name === 'node:child_process') return {spawnSync(command,args) {
      observations++; assert.equal(command,'ss'); assert.deepEqual(Array.from(args),['-H','-ltnp','sport = :51001']);
      return options.ss ?? {status:0,stdout:''};
    }};
    throw Error('Unexpected dependency: '+name);
  }});
  assert.equal(proc.exitCode,expected,name);
  assert.equal(report.errors.length === 0,expected === 0,name);
  if (options.noObservation) assert.equal(observations,0,name);
  total++;
}
run('current-run absent PID and clear exact IPv4 port',{},0);
for (const missing of ['jest-identity.json','http-listener.json']) run('missing '+missing,{missing});
run('invalid JSON',{invalidJson:true});
for (const receipt of ['identity','listener']) {
  const base = receipt === 'identity' ? identity : listener;
  for (const key of ['pid','ppid','executable','startStat','runId','runtimeRoot']) {
    const value={...base}; delete value[key]; run(`${receipt} missing ${key}`,{[receipt]:value,noObservation:true});
  }
  for (const value of [null,[],{...base,pid:0},{...base,ppid:'12'},{...base,executable:'/other/node'},{...base,startStat:'garbage'},{...base,runId:'b'.repeat(64)},{...base,runtimeRoot:'/stub/run.OLD'}]) run(`${receipt} malformed/stale`,{[receipt]:value,noObservation:true});
}
for (const patch of [{ppid:13,startStat:identity.startStat.replace(' S 12 ',' S 13 ')},{startStat:identity.startStat.replace('345','346')},{pid:123457,startStat:identity.startStat.replace('123456','123457')}]) run('cross-receipt conflict',{listener:{...listener,...patch},noObservation:true});
for (const address of [{...listener.address,family:'IPv6'},{...listener.address,address:'0.0.0.0'},{...listener.address,port:0},{...listener.address,port:'51001'},{...listener.address,port:65536}]) run('bad listener',{listener:{...listener,address},noObservation:true});
run('missing current invocation',{env:{},noObservation:true});
run('substituted stale receipt pair',{identity:{...identity,runId:'b'.repeat(64)},listener:{...listener,runId:'b'.repeat(64)},noObservation:true});
run('PID present or recycled',{present:true});
run('port occupied',{ss:{status:0,stdout:'LISTEN occupied'}});
run('ss failed',{ss:{status:1,stdout:''}});
run('ss unavailable',{ss:{status:null,stdout:null}});
console.log(`PASS ${total} cleanup receipt regressions; stub observations only, no signals/network/services`);
