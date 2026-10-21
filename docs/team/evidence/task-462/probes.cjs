'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync,execFileSync}=require('node:child_process');
const {launch,finish}=require('../task-426/process-cleanup.cjs');
const {status}=require('../task-426/exit-status.cjs');
const {validate}=require('../task-426/runtime-path.cjs');
(async()=>{
const root='/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task426-abort';validate(root,true);
const dir=fs.mkdtempSync(root+'/run.QA462');validate(dir);
try{
const rel='docs/team/evidence/task-426',dest=path.join(dir,rel);fs.mkdirSync(dest,{recursive:true});
for(const f of ['prejest.sh','prejest.cjs','preflight.cjs','provenance.cjs','runtime-path.cjs'])fs.copyFileSync(path.join('docs/team/evidence/task-426',f),path.join(dest,f));
const guardRel='docs/team/evidence/task-379/network-guard.cjs';fs.mkdirSync(path.dirname(path.join(dir,guardRel)),{recursive:true});fs.copyFileSync(guardRel,path.join(dir,guardRel));
const api=path.join(dir,'tixmoapi2');fs.mkdirSync(api+'/tests/qualification',{recursive:true});fs.mkdirSync(api+'/prisma');fs.mkdirSync(api+'/node_modules');
const source=api+'/tests/qualification/orders-http-abort.local.ts';fs.writeFileSync(source,'// offline inert fixture\n');
for(const name of ['package.json','package-lock.json','node_modules/.package-lock.json'])fs.writeFileSync(api+'/'+name,'{}');fs.writeFileSync(api+'/prisma/schema.prisma','// inert fixture');
const git=args=>execFileSync('/usr/bin/git',args,{cwd:dir,encoding:'utf8'}).trim();git(['init','-q']);git(['add','.']);git(['-c','core.hooksPath=/dev/null','-c','user.name=QA','-c','user.email=qa@local','commit','-qm','offline fixture']);
const base={TASK426_PM_RUNTIME_GRANT:'source-reviewed-sole-owner',TASK426_EXPECTED_SHA:git(['rev-parse','HEAD']),TASK426_DEPENDENCY_ROOT:api,TASK426_ARTIFACT_DIR:dir,TASK379_ALLOWED_PORTS:'2345,3456'};
const shell=path.join(dest,'prejest.sh');
function run(extra={}){return spawnSync('/bin/bash',[shell],{env:{...base,...extra},encoding:'utf8',timeout:5000});}
function denied(r,pattern){assert.equal(r.status,2,r.stderr);assert.match(r.stderr,pattern);assert.equal(r.stdout,'');}
denied(run(),/Runtime admission CLOSED/);console.log('PASS actual full fixture preflight reaches terminal refusal; no runtime path');
denied(run({TASK426_PM_RUNTIME_GRANT:''}),/Missing explicit/);console.log('PASS actual missing grant denial');
const marker=dir+'/preload-fired';const preload=dir+'/hostile.cjs';fs.writeFileSync(preload,'require("node:fs").writeFileSync('+JSON.stringify(marker)+',"BAD");');
denied(run({NODE_OPTIONS:'--require='+preload,TASK427_SCRUBBED:'1',TASK426_REJECT_PRELOAD:'0'}),/Ambient preload rejected/);assert.ok(!fs.existsSync(marker));console.log('PASS hostile inherited Node preload never executes; caller scrub markers cannot bypass env-i');
denied(run({TASK426_EXPECTED_SHA:'0'.repeat(40)}),/exact executed/);console.log('PASS actual wrong source SHA denial');
denied(run({TASK426_DEPENDENCY_ROOT:dir+'/absent'}),/ENOENT/);console.log('PASS actual missing dependency identity denial');
denied(run({TASK426_ARTIFACT_DIR:'/tmp/foreign'}),/Invalid runtime location/);console.log('PASS actual foreign private-path denial');
fs.chmodSync(dir,0o755);denied(run(),/Require owned 0700 runtime/);fs.chmodSync(dir,0o700);console.log('PASS actual nonprivate path denial');
fs.appendFileSync(source,'// drift');denied(run(),/Command failed/);fs.writeFileSync(source,'// offline inert fixture\n');console.log('PASS actual dirty source denial before guard or application');
const guard=path.join(dir,guardRel);const before=fs.readFileSync(guard);fs.appendFileSync(guard,'\nthrow Error("UNTRUSTED_GUARD_EXECUTED");');const r=run();denied(r,/Command failed/);assert.doesNotMatch(r.stderr,/UNTRUSTED_GUARD_EXECUTED/);fs.writeFileSync(guard,before);console.log('PASS actual guard mutation denied before guard execution');
const preflight=fs.readFileSync(path.join(dest,'preflight.cjs'),'utf8');assert.ok(preflight.indexOf('trackedGuard')<preflight.indexOf("require('../task-379/network-guard.cjs')"));console.log('PASS tracked guard byte comparison statically precedes guard execution');
for(const [code,want]of [['process.exit(43)',43],['process.kill(process.pid,"SIGTERM")',143]]){const child=launch(process.execPath,['-e',code],{env:{}});await child.closed;const report=await finish(child);assert.equal(status(report),want);assert.equal(status({...report,evidenceError:'fixture'}),want);}
const child=launch('/nonexistent/qa462',[],{env:{}});await new Promise(resolve=>child.child.once('close',resolve));const report=await finish(child);assert.equal(status(report),127);assert.equal(report.result.error.code,'ENOENT');assert.equal(status({result:{code:0},cleanupError:'fixture'}),1);assert.equal(status({result:{error:{code:'EACCES'}}}),126);console.log('PASS real owned exit43/SIGTERM143/ENOENT127 preserved with secondary errors; EACCES126 and cleanup failure1');
console.log('TOTAL 11 independent checks PASS; fixture identity is NOT runtime admission');
}finally{fs.chmodSync(dir,0o700);fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
