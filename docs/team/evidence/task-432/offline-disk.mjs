import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshot, compose } from '../../../../scripts/market-composition.mjs';
import { createEvidenceStore, verifyEvidence } from '../../../../scripts/market-evidence-store.mjs';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'task432-offline-'));
const git = (...args) => execFileSync('git', args, { cwd: temp, stdio: 'pipe' });
try {
 git('init');
 for (const area of ['', 'tixmoapi2', 'tdash']) {
  fs.mkdirSync(path.join(temp, area), { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) fs.writeFileSync(path.join(temp, area, file), '{}\n');
 }
 fs.writeFileSync(path.join(temp, 'source.mjs'), 'export const fixture=1;\n');
 git('add', '.'); git('-c','user.name=Offline Fixture','-c','user.email=fixture@invalid','-c','core.hooksPath=/dev/null','commit','-m','fixture');
 const initial = snapshot(temp);
 for (const file of ['source.mjs', 'tdash/package-lock.json']) {
  const original = fs.readFileSync(path.join(temp, file));
  fs.appendFileSync(path.join(temp,file),'\n');
  assert.throws(()=>snapshot(temp), /Dirty candidate/);
  fs.writeFileSync(path.join(temp,file),original);
  assert.deepEqual(snapshot(temp),initial);
 }
 // A committed lock mutation also invalidates a formerly clean identity.
 fs.appendFileSync(path.join(temp,'tdash/package-lock.json'),'\n'); git('add','.');
 git('-c','user.name=Offline Fixture','-c','user.email=fixture@invalid','-c','core.hooksPath=/dev/null','commit','-m','changed lock');
 assert.notDeepEqual(snapshot(temp),initial);
 for (const when of ['teardown', 'admission']) {
  const sourceFile=path.join(temp,'source.mjs'), original=fs.readFileSync(sourceFile); let localRuns=0, retained;
  const open=kind=>async contract=>{
   if(when==='admission'&&kind==='local')fs.appendFileSync(sourceFile,'\n');
   return {contract,close:async()=>{if(when==='teardown'&&kind==='audit')fs.appendFileSync(sourceFile,'\n');},run:async()=>{if(kind==='local')localRuns++;return {status:0,stdout:'raw',stderr:''};}};
  };
  await assert.rejects(compose({capture:()=>snapshot(temp),openAudit:open('audit'),openLocal:open('local'),persist:async m=>{retained=m;},versions:{node:process.version,npm:'offline-stub'}}),/Dirty candidate/);
  assert.equal(localRuns,0);assert.equal(retained.receipts.length,2);assert.equal(retained.qualification,'INCOMPLETE');
  fs.writeFileSync(sourceFile,original);
 }
 // Evidence root intentionally outside candidate; artifacts cannot dirty source.
 const evidence = fs.mkdtempSync(path.join(os.tmpdir(),'task432-evidence-'));
 try {
  for (const fail of [false,true]) {
   const runId = fail?'failure':'success'; let count=0;
   const open = async contract => ({contract,close:async()=>{},run:async()=>({status:fail&&++count===2?7:0,stdout:'raw\u0000bytes\n',stderr:'diagnostic\n'})});
   const persist = createEvidenceStore({directory:evidence,runId});
   const run = compose({capture:()=>snapshot(temp),openAudit:open,openLocal:open,persist,versions:{node:process.version,npm:'offline-stub'}});
   if(fail) await assert.rejects(run,/Market stage failed/); else await run;
   const dir=path.join(evidence,runId), joined=verifyEvidence(dir);
   assert.equal(joined.manifest.receipts.length,fail?2:12);
   assert.notEqual(joined.manifest.qualification,'PASS');
   await assert.rejects(persist(joined.manifest),{code:'EEXIST'});
   // Owner can chmod: demonstrate detection, never claim tamper-proof media.
   const raw=path.join(dir,'1-stdout.log');fs.chmodSync(raw,0o600);fs.writeFileSync(raw,'tampered');
   assert.throws(()=>verifyEvidence(dir),/Raw evidence mismatch/);
   fs.chmodSync(dir,0o700);
  }
  const broken=createEvidenceStore({directory:evidence,runId:'unsealed'});
  await assert.rejects(broken({receipts:[{index:1,stdout:'bad',stdoutHash:'wrong',stderr:'',stderrHash:'wrong'}]}),/hash mismatch/);
  assert.equal(fs.existsSync(path.join(evidence,'unsealed','manifest.sha256')),false);
  assert.throws(()=>verifyEvidence(path.join(evidence,'unsealed')),{code:'ENOENT'});
  assert.throws(()=>createEvidenceStore({directory:evidence,runId:'../escape'}), /Invalid/);
 } finally { fs.rmSync(evidence,{recursive:true,force:true}); }
 console.log('PASS offline real Git source/lock mutation and committed drift; joined12/failure2 raw disk receipts, seals, no overwrite, tamper detection. Stubs only.');
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
