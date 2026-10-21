import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {createEvidenceStore,verifyEvidence} from '../../../../scripts/market-evidence-store.mjs';
const parent=fs.mkdtempSync(path.join(os.tmpdir(),'tixmo436-r2-'));
const original={linkSync:fs.linkSync,fsyncSync:fs.fsyncSync,chmodSync:fs.chmodSync,unlinkSync:fs.unlinkSync};
try{
 for(const fault of ['pre-sync','run-sync','parent-sync','housekeeping']){
  const target=path.join(parent,fault);let published=false;const error=()=>{throw Object.assign(new Error('independent EIO'),{code:'EIO'});};
  const persist=createEvidenceStore({directory:parent,runId:fault});
  fs.linkSync=(...a)=>{const result=original.linkSync(...a);published=true;return result;};
  fs.fsyncSync=fd=>{const p=fs.readlinkSync('/proc/self/fd/'+fd);if((fault==='pre-sync'&&!published&&p===target)||(published&&fault==='run-sync'&&p===target)||(published&&fault==='parent-sync'&&p===parent))error();return original.fsyncSync(fd);};
  fs.chmodSync=(...a)=>{if(published&&fault==='housekeeping')error();return original.chmodSync(...a);};
  fs.unlinkSync=(...a)=>{if(published&&fault==='housekeeping')error();return original.unlinkSync(...a);};
  try{
   if(fault==='pre-sync'){await assert.rejects(persist({receipts:[]}),/independent EIO/);assert.throws(()=>verifyEvidence(target),/ENOENT/);}
   else{const result=await persist({qualification:'INCOMPLETE',receipts:[]});assert.equal(result.committed,true);assert.equal(result.durabilityConfirmed,fault==='housekeeping');assert.deepEqual(result.warnings.map(x=>x.operation),fault==='run-sync'?['sync-run-directory']:fault==='parent-sync'?['sync-parent-directory']:['remove-pending-seal','read-only-directory']);assert.ok(result.warnings.every(w=>w.code==='EIO'));assert.equal(verifyEvidence(target).manifest.qualification,'INCOMPLETE');await assert.rejects(persist({receipts:[]}),{code:'EEXIST'});}
  }finally{Object.assign(fs,original);}
 }
 console.log('PASS independent436r2 prepublication directory-fsync denial; separate run/parent postpublication fsync uncertainty; combined housekeeping warnings; qualification unchanged and no reuse');
}finally{Object.assign(fs,original);for(const d of fs.readdirSync(parent))fs.chmodSync(path.join(parent,d),0o700);fs.rmSync(parent,{recursive:true,force:true});}
