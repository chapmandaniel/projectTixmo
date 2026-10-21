'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),p=require('node:path');
const {spawnSync,execFileSync}=require('node:child_process');
const helper=p.resolve(__dirname,'../task-426');
const {launch,finish}=require(p.join(helper,'process-cleanup.cjs'));
const {status}=require(p.join(helper,'exit-status.cjs'));
let count=0;const pass=s=>console.log(`PASS ${++count} ${s}`);
(async()=>{
 const root='/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task426-abort';
 require(p.join(helper,'runtime-path.cjs')).validate(root,true);
 const dir=fs.mkdtempSync(p.join(root,'run.Lead463'));fs.chmodSync(dir,0o700);
 try {
  const dest=p.join(dir,'docs/team/evidence/task-426'),api=p.join(dir,'tixmoapi2');
  fs.mkdirSync(dest,{recursive:true});fs.mkdirSync(p.join(dir,'docs/team/evidence/task-379'));
  for(const name of ['prejest.sh','prejest.cjs','preflight.cjs','provenance.cjs','runtime-path.cjs']) fs.copyFileSync(p.join(helper,name),p.join(dest,name));
  const guard=p.join(dir,'docs/team/evidence/task-379/network-guard.cjs');fs.copyFileSync(p.resolve(helper,'../task-379/network-guard.cjs'),guard);
  const source=p.join(api,'tests/qualification/orders-http-abort.local.ts');fs.mkdirSync(p.dirname(source),{recursive:true});fs.writeFileSync(source,'// inert lead463 fixture\n');
  fs.mkdirSync(p.join(api,'prisma'));fs.mkdirSync(p.join(api,'node_modules'));
  for(const f of ['package.json','package-lock.json','node_modules/.package-lock.json'])fs.writeFileSync(p.join(api,f),'{}');
  fs.writeFileSync(p.join(api,'prisma/schema.prisma'),'// inert fixture');
  const git=args=>execFileSync('/usr/bin/git',args,{cwd:dir,encoding:'utf8'}).trim();
  git(['init','-q']);git(['add','.']);git(['-c','core.hooksPath=/dev/null','-c','user.name=Lead463','-c','user.email=lead463@example.test','commit','-qm','inert fixture']);
  const env={PATH:process.env.PATH,TASK426_PM_RUNTIME_GRANT:'source-reviewed-sole-owner',TASK426_EXPECTED_SHA:git(['rev-parse','HEAD']),TASK426_DEPENDENCY_ROOT:api,TASK426_ARTIFACT_DIR:dir,TASK379_ALLOWED_PORTS:'41231,41232'};
  const run=(extra={},pattern=/Runtime admission CLOSED/)=>{const r=spawnSync('/bin/bash',[p.join(dest,'prejest.sh')],{env:{...env,...extra},encoding:'utf8',timeout:4000});a.equal(r.status,2,r.stderr);a.match(r.stderr,pattern);return r;};
  run();pass('actual full inert preflight reaches terminal refusal, never admission');
  run({TASK426_PM_RUNTIME_GRANT:''},/Missing explicit/);pass('missing grant denied');
  const marker=p.join(dir,'PRELOAD_EXECUTED'),preload=p.join(dir,'preload.cjs');fs.writeFileSync(preload,`require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad')`);
  run({NODE_OPTIONS:`--require=${preload}`,TASK426_REJECT_PRELOAD:'0',TASK426_SCRUBBED:'1'},/Ambient preload rejected/);a.equal(fs.existsSync(marker),false);pass('malicious NODE_OPTIONS never executes despite forged scrub markers');
  run({NODE_PATH:dir,TASK426_REJECT_PRELOAD:'0'},/Ambient preload rejected/);pass('NODE_PATH cannot bypass shell-generated rejection');
  run({TASK426_EXPECTED_SHA:'0'.repeat(40)},/exact executed/);pass('wrong SHA denied');
  run({TASK426_DEPENDENCY_ROOT:p.join(dir,'absent')},/ENOENT/);pass('missing dependency tree denied');
  const deps=p.join(dir,'other');fs.mkdirSync(deps);fs.writeFileSync(p.join(deps,'package.json'),'{"different":true}');run({TASK426_DEPENDENCY_ROOT:deps},/Dependency identity mismatch/);pass('mismatched dependency manifest denied');
  run({TASK426_ARTIFACT_DIR:'/tmp/foreign-lead463'},/Invalid runtime location/);fs.chmodSync(dir,0o755);run({},/Require owned 0700/);fs.chmodSync(dir,0o700);pass('foreign and nonprivate artifact paths denied');
  fs.appendFileSync(source,'// dirty\n');run({},/Command failed/);fs.writeFileSync(source,'// inert lead463 fixture\n');pass('dirty qualification source denied');
  const bytes=fs.readFileSync(guard);fs.writeFileSync(guard,"throw new Error('GUARD_EXECUTED_LEAD463');\n");const r=run({},/Command failed/);a.doesNotMatch(r.stderr,/GUARD_EXECUTED_LEAD463/);fs.writeFileSync(guard,bytes);pass('mutated tracked guard denied before execution (global dirty check)');
  const text=fs.readFileSync(p.join(dest,'preflight.cjs'),'utf8');a.ok(text.indexOf('equals(trackedGuard)')<text.indexOf("require('../task-379/network-guard.cjs')"));pass('specific guard byte identity check precedes require in source');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 for(const [script,expected] of [['process.exit(51)',51],['process.kill(process.pid,"SIGTERM")',143]]){
  const rec=launch(process.execPath,['-e',script],{env:{}});await rec.closed;const report=await finish(rec);a.equal(status(report),expected);a.equal(status({...report,cleanupError:'secondary',evidenceError:'secondary'}),expected);pass(`actual owned subprocess primary ${expected} survives secondary errors`);
 }
 const rec=launch('/nonexistent/lead463-owned', ['literal-arg'],{env:{}});await new Promise(resolve=>rec.child.once('close',resolve));const report=await finish(rec);const round=JSON.parse(JSON.stringify(report));a.equal(status(round),127);a.equal(status({...round,evidenceError:'ENOSPC'}),127);a.match(round.result.error.message,/ENOENT/);a.equal(round.result.error.path,'/nonexistent/lead463-owned');a.deepEqual(round.result.error.spawnargs,['literal-arg']);pass('actual ENOENT close plus JSON diagnostics and secondary error preserve127');
 a.equal(status({result:{code:0}}),0);a.equal(status({result:{code:0},cleanupError:'failed'}),1);a.equal(status({result:{error:{code:'EACCES'}}}),126);a.equal(status({timedOut:true,result:{code:0}}),124);pass('success/secondary/spawnpermission/timeout fallback mappings');
 console.log(`TOTAL ${count} independent checks PASS; no sockets, no app, all direct children closed/reaped`);
})().catch(e=>{console.error(e);process.exitCode=1;});
