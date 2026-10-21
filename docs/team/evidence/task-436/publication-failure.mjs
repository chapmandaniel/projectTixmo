import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createEvidenceStore,verifyEvidence} from '../../../../scripts/market-evidence-store.mjs';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tixmo436-publish-'));
const target=path.join(directory,'run');const original=fs.chmodSync;
try {
 const persist=createEvidenceStore({directory,runId:'run'});
 fs.chmodSync=(file,...args)=>{if(file===target)throw Object.assign(new Error('injected post-publication chmod failure'),{code:'EIO'});return original(file,...args);};
 await assert.rejects(persist({qualification:'INCOMPLETE',receipts:[]}),/injected post-publication/);
 fs.chmodSync=original;
 assert.equal(fs.existsSync(path.join(target,'manifest.sha256')),true);
 assert.equal(verifyEvidence(target).manifest.qualification,'INCOMPLETE');
 console.log('REPRO FINDING: persistence rejects after publication, but sealed bundle remains reader-valid; failed writer is not always unsealed');
}finally{fs.chmodSync=original;fs.rmSync(directory,{recursive:true,force:true});}
