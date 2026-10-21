'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {execFileSync,spawnSync}=require('node:child_process');
const {tracker,finalize}=require('../task-426/lifecycle.cjs');
const {promiseMiddleware}=require('../task-426/middleware-lifetime.cjs');
const {verify}=require('../task-426/provenance.cjs');
const deps='/home/daniel/projects/projectTixmo/worktrees/task-434/tixmoapi2/node_modules/';
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
let n=0;const pass=x=>console.log('PASS '+(++n)+' '+x);
(async()=>{
 const {rateLimit}=require(deps+'express-rate-limit'),{spyOn}=require(deps+'jest-mock');
 for(const fail of [false,true]){
  const work=tracker(),store=defer(),entered=defer(),child=defer();let next=0,restored=false,disconnected=false;
  const original=rateLimit({windowMs:10000,limit:10,validate:false,standardHeaders:false,legacyHeaders:false,store:{localKeys:false,init(){},async increment(){entered.resolve();await store.promise;if(fail)throw Error('synthetic increment failure');return{totalHits:1};},async decrement(){},async resetKey(){}}});
  const obj={limiter:original},spy=spyOn(obj,'limiter').mockImplementation(promiseMiddleware(original,work));
  const pending=obj.limiter({ip:'127.0.0.1',method:'POST',headers:{},app:{get(){return false;}}},{on(){},setHeader(){}},err=>{assert.equal(Boolean(err),fail);assert(!restored&&!disconnected);next++;work.run(()=>child.promise);});
  await entered.promise;
  const cleanup=finalize({steps:[['join',()=>work.join(1000)],['restore',()=>{spy.mockRestore();restored=true;}],['disconnect',()=>{assert(restored);disconnected=true;}]],receipt:()=>({}),publish(){}});
  await assert.rejects(work.join(5),/deadline/);assert.equal(next,0);store.resolve();await pending;
  await assert.rejects(work.join(5),/deadline/);assert(!restored&&!disconnected);child.resolve();await cleanup;assert.equal(obj.limiter,original);assert.equal(next,1);assert(disconnected);pass('installed limiter '+(fail?'error':'success')+' full continuation + child block restoration/disconnect');
 }
 const w=tracker();await assert.rejects(promiseMiddleware(()=>undefined,w)(),/Expected promise/);await w.join();pass('non-promise middleware fails explicitly rather than attesting lifetime');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lead447-'));const old=process.cwd();
 try{
  const api=path.join(dir,'tixmoapi2'),source=path.join(api,'tests/qualification/probe.ts'),modules=path.join(api,'node_modules'),pkg=path.join(modules,'fixture');
  fs.mkdirSync(path.dirname(source),{recursive:true});fs.mkdirSync(path.join(api,'prisma'));fs.mkdirSync(pkg,{recursive:true});
  fs.writeFileSync(source,'// fixture\n');fs.writeFileSync(path.join(dir,'.gitignore'),'node_modules/\n');fs.writeFileSync(path.join(api,'package.json'),JSON.stringify({dependencies:{fixture:'1.0.0'}}));fs.writeFileSync(path.join(api,'package-lock.json'),'{}');fs.writeFileSync(path.join(api,'prisma/schema.prisma'),'// fixture');fs.writeFileSync(path.join(modules,'.package-lock.json'),'{}');fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({name:'fixture',version:'1.0.0',main:'index.js'}));fs.writeFileSync(path.join(pkg,'index.js'),'module.exports=1;');
  const git=a=>execFileSync('git',a,{cwd:dir,encoding:'utf8'}).trim();git(['init','--quiet']);git(['add','.']);git(['-c','user.name=Lead fixture','-c','user.email=lead@local','-c','core.hooksPath=/dev/null','commit','--quiet','-m','fixture']);
  const env={TASK426_EXPECTED_SHA:git(['rev-parse','HEAD']),TASK426_DEPENDENCY_ROOT:api};process.chdir('/home/daniel/projects/projectTixmo/main');
  const result=verify(source,env);assert.equal(result.sourceRoot,dir);assert.equal(result.sourceSHA,env.TASK426_EXPECTED_SHA);assert.equal(result.resolved.fixture.entry,path.join(pkg,'index.js'));assert.match(result.resolved.fixture.entryDigest,/^[a-f0-9]{64}$/);pass('wrong caller cwd still binds executed SHA and real production dependency entry + digest');
  const freshVerify=()=>{const r=spawnSync(process.execPath,['-e','require(process.argv[1]).verify(process.argv[2],JSON.parse(process.argv[3]))',path.resolve(__dirname,'../task-426/provenance.cjs'),source,JSON.stringify(env)],{encoding:'utf8'});assert.notEqual(r.status,0);return r.stderr;};
  fs.writeFileSync(path.join(dir,'outside.js'),'module.exports=2;');fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({name:'fixture',main:'../../../outside.js'}));assert.match(freshVerify(),/entry resolves outside/);pass('production dependency main escaping modules rejected');
  fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({name:'fixture',main:'index.js'}));fs.renameSync(pkg,path.join(dir,'external-package'));fs.symlinkSync(path.join(dir,'external-package'),pkg);assert.match(freshVerify(),/Dependency resolves outside/);pass('dependency directory symlink escaping modules rejected');
  assert.throws(()=>verify(source,{...env,TASK426_EXPECTED_SHA:'0'.repeat(40)}),/exact executed/);fs.writeFileSync(source,'// dirty');assert.throws(()=>verify(source,env));pass('wrong SHA and executed source mutation fail closed');
 }finally{process.chdir(old);fs.rmSync(dir,{recursive:true,force:true});}
 const root=path.resolve(__dirname,'../../../..'),text=fs.readFileSync(path.join(root,'tixmoapi2/tests/qualification/orders-http-abort.local.ts'),'utf8'),ts=require(deps+'typescript');
 const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,seen=[],stop=Error('guard reject');
 assert.throws(()=>vm.runInNewContext(js,{exports:{},__filename:'/synthetic.ts',process:{env:{}},jest:{unmock(){},mock(){}},require(name){seen.push(name);if(name.endsWith('/provenance.cjs'))return{verify(){throw stop;}};assert(['crypto','fs','path','http','net'].includes(name),'import before guard '+name);return require(name);}}),e=>e===stop);assert(!seen.some(x=>x.includes('/src/')||x==='supertest'));pass('EXECUTED emitted CommonJS rejects before supertest/product requires (not before Jest setup)');
 assert(text.indexOf('promiseMiddleware(original, work)')<text.indexOf("import('../../src/app')"));assert(text.includes("['apiReadRateLimiter', 'apiWriteRateLimiter', 'authRateLimiter']"));assert(text.includes('commandLayer.spy'));assert(text.indexOf("['join admitted mutable work'")<text.indexOf("['restore instrumentation'"));pass('all limiter exports/sendCommand instrumented pre-app and final join precedes restoration');
 console.log('TOTAL '+n+' independent offline checks PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
