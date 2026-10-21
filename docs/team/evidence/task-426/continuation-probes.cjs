'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {tracker} = require('./lifecycle.cjs');
const {promiseMiddleware} = require('./middleware-lifetime.cjs');
const {verify} = require('./provenance.cjs');
const deps = '/home/daniel/projects/projectTixmo/worktrees/task-434/tixmoapi2/node_modules/';
(async () => {
  const {rateLimit} = require(deps + 'express-rate-limit');
  for (const failing of [false, true]) {
    const work = tracker(); let release, startedResolve;
    const started = new Promise(r=>startedResolve=r), gate = new Promise(r=>release=r);
    let disconnected=false, downstream=0, seen;
    const limiter = rateLimit({windowMs:60000,limit:10,validate:false,standardHeaders:false,legacyHeaders:false,store:{localKeys:false,init(){},async increment(){startedResolve();await gate;if(failing)throw new Error('store failure');return {totalHits:1};},async decrement(){},async resetKey(){}}});
    const wrapped = promiseMiddleware(limiter,work);
    const pending = wrapped({ip:'127.0.0.1',method:'POST',originalUrl:'/api/v1/orders',headers:{},app:{get(){return false;}}},{on(){},setHeader(){}},error=>{
      assert.equal(disconnected,false);seen=error;downstream++;
      // Synchronously admitted child must also be joined after limiter completes.
      work.run(async()=>{await new Promise(r=>setImmediate(r));assert.equal(disconnected,false);});
    });
    await started;await assert.rejects(work.join(10),/deadline/);
    assert.equal(downstream,0);release();await pending;await work.join();disconnected=true;
    await new Promise(r=>setImmediate(r));assert.equal(downstream,1);assert.equal(Boolean(seen),failing);
  }
  console.log('PASS installed express-rate-limit deferred store success/error: join blocks before gate, downstream and child finish before synthetic disconnect');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tixmo426-source-'));
  // Entirely local Git fixture: no services, product imports or dependency installs.
  try {
    const source=path.join(dir,'tixmoapi2/tests/qualification/probe.ts');
    fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,'// exact synthetic source\n');
    const api=path.join(dir,'tixmoapi2');fs.mkdirSync(path.join(api,'prisma'));fs.mkdirSync(path.join(api,'node_modules'));
    fs.writeFileSync(path.join(api,'package.json'),'{}');fs.writeFileSync(path.join(api,'package-lock.json'),'{}');fs.writeFileSync(path.join(api,'prisma/schema.prisma'),'// synthetic');fs.writeFileSync(path.join(api,'node_modules/.package-lock.json'),'{}');
    const git=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8'}).trim();
    git(['init','--quiet']);git(['add','tixmoapi2']);git(['-c','user.name=Offline probe','-c','user.email=offline@example.test','-c','core.hooksPath=/dev/null','commit','--quiet','-m','synthetic source']);
    const env={TASK426_EXPECTED_SHA:git(['rev-parse','HEAD']),TASK426_DEPENDENCY_ROOT:api};
    const receipt=verify(source,env);assert.equal(receipt.sourceRoot,dir);assert.equal(receipt.sourceSHA,env.TASK426_EXPECTED_SHA);
    assert.throws(()=>verify(source,{...env,TASK426_EXPECTED_SHA:'0'.repeat(40)}),/exact executed/);
    assert.throws(()=>verify(source,{...env,TASK426_DEPENDENCY_ROOT:'/tmp/missing-deps'}));
    fs.writeFileSync(source,'// tampered\n');assert.throws(()=>verify(source,env));
    console.log('PASS executed-root provenance independent of caller cwd; wrong expected SHA, absent deps, dirty executed source reject before imports');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
  const text=fs.readFileSync(path.resolve(__dirname,'../../../../tixmoapi2/tests/qualification/orders-http-abort.local.ts'),'utf8');
  const ts=require(deps+'typescript');const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  assert(js.indexOf('.verify(__filename, process.env)')<js.indexOf('require("../../src/config/prisma")'));
  console.log('PASS emitted CommonJS provenance verifies before first product import; future runner/preload still required');
})().catch(e=>{console.error(e);process.exitCode=1;});
