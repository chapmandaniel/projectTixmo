'use strict';
// Independent review: candidate producer and observer evaluated with stubs only.
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path'), assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../task-393/process-cleanup.cjs'),'utf8');
const testPath='tixmoapi2/tests/integration/orders-http-pressure.local.test.ts';
const producer=fs.readFileSync(testPath,'utf8');
const root='/owned/run.CURRENT', challenge='d'.repeat(64), exe='/installed/node';
const numbers=Array(49).fill('0'); numbers[0]='80';numbers[18]='987654';
const stat=`91234 (node (Jest worker)) S ${numbers.join(' ')}\n`;
let id;
// Execute the exact candidate producer fragment; no receipt contract copy.
const fragment=producer.slice(producer.indexOf('  const runId ='),producer.indexOf('  let ACTIVE_REQUESTS_KEY'));
function produce(env) { let saved; vm.runInNewContext(fragment,{process:{env,pid:91234,ppid:80,execPath:exe},artifact:root,path,fs:{readFileSync(p){assert.equal(p,'/proc/91234/stat');return stat;},writeFileSync(p,v){assert.equal(p,path.join(root,'jest-identity.json'));saved=JSON.parse(v);}}});return saved; }
id=produce({TASK379_RUN_ID:challenge});
assert.throws(()=>produce({}),/invocation/);
assert.throws(()=>produce({TASK379_RUN_ID:'stale'}),/invocation/);
const listener={...id,address:{address:'127.0.0.1',family:'IPv4',port:54321}};
let total=0;
function run(name,opts={},expected=1) {
 let report,queries=0;
 const proc={argv:['node','observer',root],env:{TASK379_RUN_ID:challenge},execPath:exe,exitCode:0,...opts.process};
 vm.runInNewContext(source,{process:proc,console:{log(){}},require(n){
  if(n==='node:path')return path;
  if(n==='../task-379/runtime-path.cjs')return {validate(p){assert.equal(p,root);}};
  if(n==='node:fs')return {readFileSync(p){const key=p.endsWith('jest-identity.json')?'id':'listener'; if(opts.missing===key)throw Error('ENOENT'); if(opts.invalid===key)return '{';return JSON.stringify(Object.hasOwn(opts,key)?opts[key]:key==='id'?id:listener);},existsSync(p){assert.equal(p,'/proc/91234');return !!opts.present;},writeFileSync(p,s){assert.equal(p,path.join(root,'process-cleanup.json'));report=JSON.parse(s);}};
  if(n==='node:child_process')return {spawnSync(command,args,options){queries++;assert.equal(command,'ss');assert.deepEqual(Array.from(args),['-H','-ltnp','sport = :54321']);assert.equal(options.encoding,'utf8');return opts.ss??{status:0,stdout:''};}};
  throw Error('Forbidden dependency '+n);
 }});
 assert.equal(proc.exitCode,expected,name);assert.equal(report.errors.length===0,expected===0,name);
 if(opts.preflight)assert.equal(queries,0,name);total++;
}
run('exact producer current-run success',{},0);
for(const receipt of ['id','listener']) {
 const base=receipt==='id'?id:listener;
 for(const value of [null,[],0,'garbage'])run(`${receipt} scalar`,{[receipt]:value,preflight:true});
 for(const key of Object.keys(id)){const changed={...base};delete changed[key];run(`${receipt} missing ${key}`,{[receipt]:changed,preflight:true});}
 for(const patch of [{pid:0},{pid:'91234'},{pid:1.5},{pid:Number.MAX_SAFE_INTEGER+1},{ppid:0},{ppid:91234},{ppid:'80'},{executable:'/wrong/node'},{startStat:'garbage'},{startStat:stat.replace('91234','91235')},{startStat:stat.replace(' S 80 ',' S 81 ')},{startStat:stat.replace('987654','0')},{startStat:stat.replace('987654','-1')},{startStat:stat+'1'},{runId:'e'.repeat(64)},{runtimeRoot:'/owned/run.OLD'}]) run(`${receipt} malformed ${JSON.stringify(patch)}`,{[receipt]:{...base,...patch},preflight:true});
 run(`${receipt} missing receipt`,{missing:receipt,preflight:true});run(`${receipt} invalid JSON`,{invalid:receipt,preflight:true});
}
for(const patch of [{startStat:stat.replace('987654','987655')},{ppid:81,startStat:stat.replace(' S 80 ',' S 81 ')}])run('individually valid conflicting listener identity',{listener:{...listener,...patch},preflight:true});
for(const address of [null,{},'127.0.0.1',{...listener.address,family:'IPv6'},{...listener.address,address:'::1'},{...listener.address,address:'localhost'},{...listener.address,address:'0.0.0.0'},...[0,65536,-1,1.5,'54321'].map(port=>({...listener.address,port}))])run('bad listener endpoint',{listener:{...listener,address},preflight:true});
for(const patch of [{runId:'e'.repeat(64)},{runtimeRoot:'/owned/run.OLD'}])run('paired internally consistent stale receipts',{id:{...id,...patch},listener:{...listener,...patch},preflight:true});
for(const env of [{},{TASK379_RUN_ID:'bad'},{TASK379_RUN_ID:'e'.repeat(64)}])run('separate expected invocation rejects',{process:{env},preflight:true});
run('PID present including reuse',{present:true});
for(const ss of [{status:0,stdout:'LISTEN occupied'},{status:1,stdout:''},{status:null,stdout:null},{status:0,stdout:null}])run('observation fails closed',{ss});
const shell=fs.readFileSync('docs/team/evidence/task-379/runtime.sh','utf8');
assert(shell.indexOf('owned_run=$(mktemp')<shell.indexOf('export TASK379_RUN_ID='));
assert(shell.includes("randomBytes(32).toString('hex')"));
assert(shell.includes('process-cleanup.cjs" "$owned_run" || cleanup_failed=1'));
assert(producer.includes("JSON.stringify({ ...identity, address }, null, 2)"));
console.log(`PASS ${total} independent observer cases + exact producer fragment, missing/bad challenge producer rejection, runner fresh challenge/export/current-root source checks; no real fs/proc/ss/network/signals inside candidate`);
