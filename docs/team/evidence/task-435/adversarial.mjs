import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {createEvidenceStore,verifyEvidence} from '../../../../scripts/market-evidence-store.mjs';
const h=x=>createHash('sha256').update(x).digest('hex');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'qa435-'));
const receipt={index:1,stdout:'receipt\u0000one\n',stderr:'diagnostic\n',stdoutHash:h('receipt\u0000one\n'),stderrHash:h('diagnostic\n')};
try{
 const persist=createEvidenceStore({directory:root,runId:'concurrent'});
 const writes=await Promise.allSettled([persist({receipts:[receipt]}),persist({receipts:[receipt]})]);
 assert.equal(writes.filter(x=>x.status==='fulfilled').length,1);assert.equal(writes.filter(x=>x.status==='rejected'&&x.reason.code==='EEXIST').length,1);
 const dir=path.join(root,'concurrent');assert.equal(verifyEvidence(dir).manifest.receipts[0].stdout,receipt.stdout);
 const manifest=path.join(dir,'manifest.json'),seal=path.join(dir,'manifest.sha256');
 const original=fs.readFileSync(manifest), originalSeal=fs.readFileSync(seal);
 fs.chmodSync(manifest,0o600);fs.writeFileSync(manifest,'{}');assert.throws(()=>verifyEvidence(dir),/seal mismatch/);
 const wrong=JSON.parse(original);wrong.raw[0].index=2;const bytes=JSON.stringify(wrong);fs.writeFileSync(manifest,bytes);fs.chmodSync(seal,0o600);fs.writeFileSync(seal,h(bytes)+'\n');assert.throws(()=>verifyEvidence(dir),/Raw index mismatch/);
 fs.writeFileSync(manifest,original);fs.writeFileSync(seal,originalSeal);
 fs.chmodSync(dir,0o700);fs.renameSync(seal,path.join(dir,'saved-seal'));assert.throws(()=>verifyEvidence(dir),{code:'ENOENT'});
 fs.symlinkSync(path.join(dir,'saved-seal'),seal);assert.throws(()=>verifyEvidence(dir),/Invalid evidence file/);
 const broken=createEvidenceStore({directory:root,runId:'partial'});await assert.rejects(broken({receipts:[receipt,{...receipt,index:3}]}),/Noncanonical/);
 assert.equal(fs.existsSync(path.join(root,'partial/1-stdout.log')),true);assert.equal(fs.existsSync(path.join(root,'partial/manifest.sha256')),false);assert.throws(()=>verifyEvidence(path.join(root,'partial')),{code:'ENOENT'});
 await assert.rejects(broken({receipts:[]}),{code:'EEXIST'});
 console.log('PASS independent concurrent no-clobber, binary-string raw receipt, manifest seal tamper, rehashed raw association tamper, absent/symlink seal, partial-write no seal and no reuse.');
}finally{fs.chmodSync(path.join(root,'concurrent'),0o700);fs.rmSync(root,{recursive:true,force:true});}
