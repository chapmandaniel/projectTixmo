'use strict';
// Independent QA399: execute candidate code with strict filesystem/ss stubs.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const observer=fs.readFileSync('docs/team/evidence/task-393/process-cleanup.cjs','utf8');
const producer=fs.readFileSync('tixmoapi2/tests/integration/orders-http-pressure.local.test.ts','utf8');
const runner=fs.readFileSync('docs/team/evidence/task-379/runtime.sh','utf8');
const root='/qa/current-run',runId='c'.repeat(64),exe='/qa/installed/node';
const fields=Array(49).fill('0');fields[0]='51';fields[18]='789012';
const stat=`45678 (jest (test worker)) S ${fields.join(' ')}\n`;
const piece=producer.slice(producer.indexOf('  const runId ='),producer.indexOf('  let ACTIVE_REQUESTS_KEY'));
function produce(env){let result;vm.runInNewContext(piece,{artifact:root,path,process:{env,pid:45678,ppid:51,execPath:exe},fs:{readFileSync(p,encoding){assert.equal(p,'/proc/45678/stat');assert.equal(encoding,'utf8');return stat},writeFileSync(p,s){assert.equal(p,root+'/jest-identity.json');result=JSON.parse(s)}}});return result}
const identity=produce({TASK379_RUN_ID:runId}),listener={...identity,address:{address:'127.0.0.1',family:'IPv4',port:61234}};
assert.throws(()=>produce({}));assert.throws(()=>produce({TASK379_RUN_ID:'short'}));
assert(producer.includes('JSON.stringify({ ...identity, address }, null, 2)'));
let count=0;
function check(name,patch={},pass=false,preflight=true){let report,queries=0;const proc={argv:['node','observer',root],env:{TASK379_RUN_ID:runId},execPath:exe,exitCode:0,...patch.proc};
vm.runInNewContext(observer,{process:proc,console:{log(){}},require(n){if(n==='node:path')return path;if(n==='../task-379/runtime-path.cjs')return {validate(p){assert.equal(p,root)}};if(n==='node:fs')return {readFileSync(p){const key=path.basename(p)==='jest-identity.json'?'identity':'listener';if(patch.missing===key)throw Error('ENOENT');if(patch.invalid===key)return '{';return JSON.stringify(Object.hasOwn(patch,key)?patch[key]:key==='identity'?identity:listener)},existsSync(p){assert.equal(p,'/proc/45678');return !!patch.present},writeFileSync(p,s){assert.equal(p,root+'/process-cleanup.json');report=JSON.parse(s)}};if(n==='node:child_process')return {spawnSync(cmd,args){queries++;assert.equal(cmd,'ss');assert.deepEqual(Array.from(args),['-H','-ltnp','sport = :61234']);return patch.ss??{status:0,stdout:''}}};throw Error('Forbidden dependency '+n)}});
assert.equal(proc.exitCode,pass?0:1,name);assert.equal(report.errors.length===0,pass,name);if(preflight&&!pass)assert.equal(queries,0,name);count++;console.log('PASS '+name)}
check('current producer / absent PID / empty exact IPv4 port',{},true);
for(const key of ['identity','listener']){
 for(const value of [null,[],false,7,'bad'])check(key+' nonobject '+JSON.stringify(value),{[key]:value});
 for(const field of Object.keys(identity)){const value={...(key==='identity'?identity:listener)};delete value[field];check(key+' missing '+field,{[key]:value})}
 for(const change of [{pid:-1},{pid:1.1},{pid:'45678'},{pid:9007199254740992},{ppid:0},{ppid:45678},{ppid:'51'},{executable:'node'},{executable:'/wrong/node'},{runtimeRoot:root+'/old'},{runId:'d'.repeat(64)},{startStat:'garbage'},{startStat:stat.replace('45678','45679')},{startStat:stat.replace(' S 51 ',' S 52 ')},{startStat:stat.replace('789012','0')},{startStat:stat.replace('789012','-99')},{startStat:stat.trim()+' 0'}])check(key+' invalid '+JSON.stringify(change),{[key]:{...(key==='identity'?identity:listener),...change}});
 check(key+' absent',{missing:key});check(key+' malformed JSON',{invalid:key});
}
for(const patch of [{runtimeRoot:'/qa/previous-run'},{runId:'e'.repeat(64)}])check('paired stale '+JSON.stringify(patch),{identity:{...identity,...patch},listener:{...listener,...patch}});
for(const patch of [{startStat:stat.replace('789012','789013')},{ppid:52,startStat:stat.replace(' S 51 ',' S 52 ')}])check('valid crossreceipt conflict '+JSON.stringify(patch),{listener:{...listener,...patch}});
for(const address of [null,{},[],{...listener.address,address:'localhost'},{...listener.address,address:'::1'},{...listener.address,address:'0.0.0.0'},{...listener.address,family:'IPv6'},...[0,65536,0.5,'61234'].map(port=>({...listener.address,port}))])check('bad endpoint '+JSON.stringify(address),{listener:{...listener,address}});
for(const env of [{},{TASK379_RUN_ID:'bad'},{TASK379_RUN_ID:'f'.repeat(64)}])check('expected invocation '+JSON.stringify(env),{proc:{env}});
check('present or recycled PID',{present:true},false,false);
for(const ss of [{status:0,stdout:'LISTEN occupied'},{status:1,stdout:''},{status:null,stdout:null},{status:0,stdout:null}])check('ss failclosed '+JSON.stringify(ss),{ss},false,false);
// Execute only candidate challenge assignment, never the runtime script.
const assignment=runner.split('\n').find(l=>l.startsWith('export TASK379_RUN_ID='));
assert(runner.indexOf('owned_run=$(mktemp')<runner.indexOf(assignment));
assert(runner.includes('process-cleanup.cjs" "$owned_run" || cleanup_failed=1'));
const fresh=()=>cp.execFileSync('/bin/bash',['-c',assignment+'\nprintf %s "$TASK379_RUN_ID"'],{env:{PATH:process.env.PATH,TASK379_RUN_ID:'old-inherited-value'},encoding:'utf8'});
const a=fresh(),b=fresh();assert.match(a,/^[a-f0-9]{64}$/);assert.match(b,/^[a-f0-9]{64}$/);assert.notEqual(a,b);
console.log(`PASS ${count} independent observer cases; exact producer success + 2 rejection cases; 2 fresh exact shell challenge assignments overwrite inherited value. No candidate real proc/ss/network/signals.`);
