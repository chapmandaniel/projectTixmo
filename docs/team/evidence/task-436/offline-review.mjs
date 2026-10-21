import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createEvidenceStore,verifyEvidence} from '../../../../scripts/market-evidence-store.mjs';
const h=s=>createHash('sha256').update(s).digest('hex');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tixmo436-'));
const receipt={index:1,stdout:'NUL\u0000line\n',stderr:'',stdoutHash:h('NUL\u0000line\n'),stderrHash:h('')};
const manifest={qualification:'INCOMPLETE',receipts:[receipt]};
try {
 const publicDir=path.join(temp,'public');fs.mkdirSync(publicDir,{mode:0o755});
 assert.throws(()=>createEvidenceStore({directory:publicDir,runId:'x'}),/private and owned/);
 fs.symlinkSync(temp,path.join(temp,'alias'));
 assert.throws(()=>createEvidenceStore({directory:path.join(temp,'alias'),runId:'x'}),/private and owned|symlinks/);
 assert.throws(()=>createEvidenceStore({directory:temp,runId:'../escape'}),/Invalid/);
 const persist=createEvidenceStore({directory:temp,runId:'run'});
 const results=await Promise.allSettled([persist(manifest),persist(manifest)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'EEXIST');
 const dir=path.join(temp,'run');assert.deepEqual(verifyEvidence(dir).manifest,manifest);
 assert.equal(fs.statSync(path.join(dir,'1-stdout.log')).mode&0o777,0o400);
 // Even recomputing the top seal cannot conceal a broken canonical raw mapping.
 const file=path.join(dir,'manifest.json');fs.chmodSync(file,0o600);
 const joined=JSON.parse(fs.readFileSync(file));joined.raw[0].index=2;
 const changed=JSON.stringify(joined);fs.writeFileSync(file,changed);
 const seal=path.join(dir,'manifest.sha256');fs.chmodSync(seal,0o600);fs.writeFileSync(seal,h(changed)+'\n');
 assert.throws(()=>verifyEvidence(dir),/Raw index mismatch/);
 fs.chmodSync(dir,0o700);fs.unlinkSync(seal);fs.symlinkSync(file,seal);
 assert.throws(()=>verifyEvidence(dir),/Invalid evidence file/);
 const broken=createEvidenceStore({directory:temp,runId:'broken'});
 await assert.rejects(broken({receipts:[receipt,{...receipt,index:2,stdoutHash:'bad'}]}),/hash mismatch/);
 assert.equal(fs.existsSync(path.join(temp,'broken','1-stdout.log')),true);
 assert.equal(fs.existsSync(path.join(temp,'broken','manifest.sha256')),false);
 assert.throws(()=>verifyEvidence(path.join(temp,'broken')),{code:'ENOENT'});
 await assert.rejects(broken(manifest),{code:'EEXIST'});
 console.log('PASS independent436 private/symlink/traversal, concurrent reservation, NUL/raw/readmode, rehashed association tamper, symlink seal, partialwrite/no-reuse');
} finally {for(const entry of fs.readdirSync(temp,{withFileTypes:true}))if(entry.isDirectory())fs.chmodSync(path.join(temp,entry.name),0o700);fs.rmSync(temp,{recursive:true,force:true});}
