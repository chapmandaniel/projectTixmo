'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync, execFileSync} = require('node:child_process');
const {launch,finish} = require('./process-cleanup.cjs');
const {status} = require('./exit-status.cjs');
const {verify} = require('./provenance.cjs');
const {validate} = require('./runtime-path.cjs');
(async()=>{
  const entry=path.join(__dirname,'prejest.sh');
  const base={PATH:process.env.PATH,TASK426_PM_RUNTIME_GRANT:'source-reviewed-sole-owner',TASK426_EXPECTED_SHA:'0'.repeat(40)};
  for (const [env, pattern] of [
    [{...base,TASK426_PM_RUNTIME_GRANT:''},/Missing explicit/],
    [{...base,NODE_OPTIONS:'--require=/nonexistent/preload.cjs'},/Ambient preload rejected/],
    [base,/exact executed/],
  ]) {
    const child=spawnSync('/bin/bash',[entry],{env,encoding:'utf8'});
    assert.equal(child.status,2); assert.match(child.stderr,pattern);
    assert.doesNotMatch(child.stderr,/Cannot find module/);
  }
  // Real offline Git/dependency fixtures: no module substitution or fake admission.
  const root='/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task426-abort';
  validate(root,true);
  const dir=fs.mkdtempSync(path.join(root,'run.'));fs.chmodSync(dir,0o700);
  try {
    validate(dir); assert.throws(()=>validate('/tmp/not-task426'),/Invalid runtime/);
    const api=path.join(dir,'tixmoapi2'), source=path.join(api,'tests/qualification/probe.ts');
    fs.mkdirSync(path.dirname(source),{recursive:true});fs.mkdirSync(path.join(api,'prisma'));
    fs.mkdirSync(path.join(api,'node_modules'));
    fs.writeFileSync(source,'// offline fixture only\n');
    for (const file of ['package.json','package-lock.json','node_modules/.package-lock.json']) fs.writeFileSync(path.join(api,file),'{}');
    fs.writeFileSync(path.join(api,'prisma/schema.prisma'),'// fixture');
    const git=args=>execFileSync('/usr/bin/git',args,{cwd:dir,encoding:'utf8'}).trim();
    git(['init','--quiet']);git(['add','.']);git(['-c','core.hooksPath=/dev/null','-c','user.name=Offline','-c','user.email=offline@example.test','commit','--quiet','-m','offline']);
    const env={TASK426_EXPECTED_SHA:git(['rev-parse','HEAD']),TASK426_DEPENDENCY_ROOT:api};
    assert.equal(verify(source,env).sourceRoot,dir);
    assert.throws(()=>verify(source,{...env,TASK426_DEPENDENCY_ROOT:path.join(dir,'absent')}));
    fs.writeFileSync(source,'// changed');assert.throws(()=>verify(source,env));
    fs.writeFileSync(source,'// offline fixture only\n');
    const other=path.join(dir,'other');fs.mkdirSync(other);
    fs.writeFileSync(path.join(other,'package.json'),'{"changed":true}');
    assert.throws(()=>verify(source,{...env,TASK426_DEPENDENCY_ROOT:other}),/Dependency identity mismatch/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
  for (const [script,expected] of [['process.exit(37)',37],['process.kill(process.pid,"SIGTERM")',143]]) {
    const child=launch(process.execPath,['-e',script],{env:{}});
    await child.closed;const report=await finish(child);assert.equal(status(report),expected);
    assert.equal(status({...report,evidenceError:'receipt failed'}),expected);
  }
  const missing=launch('/nonexistent/task426-offline',[],{env:{}});
  await new Promise(resolve=>missing.child.once('close',resolve));
  const report=await finish(missing);assert.equal(status(report),127);
  assert.equal(report.result.error.code,'ENOENT');
  assert.equal(status({result:{code:0},evidenceError:'ENOSPC'}),1);
  console.log('PASS scrubbed shell grant/preload/SHA denials; actual disk path/source/dependency denials; real owned exit37/SIGTERM/ENOENT mapping. NO application/Jest/provisioning path exists in entry; fixture identity success is NOT runtime admission.');
})().catch(error=>{console.error(error);process.exitCode=1;});
