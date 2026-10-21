import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require=createRequire(import.meta.url);
const {validate}=require('../task-379/runtime-path.cjs');
const shell=fs.readFileSync('docs/team/evidence/task-427/runtime.sh','utf8');
const binding='export TASK379_ARTIFACT_DIR="$owned_run"';
assert.equal(shell.split(binding).length,2);
const validation=shell.indexOf('node "$PWD/docs/team/evidence/task-379/runtime-path.cjs" "$owned_run"');
const publication=shell.indexOf('TASK432_SOURCE_IDENTITY="$task432_identity" node --input-type=module');
assert.ok(validation>0&&validation<shell.indexOf(binding)&&shell.indexOf(binding)<publication&&publication<shell.indexOf('"$pgbin/initdb"'));
let actual=shell.slice(publication,shell.indexOf("\n'",publication)+2);
assert.match(actual,/fs.openSync\(process.env.TASK379_ARTIFACT_DIR \+ "\/api-identity.json", "wx", 0o400\)/);
assert.match(actual,/fs.fsyncSync\(fd\)/);assert.match(actual,/finally \{ fs.closeSync\(fd\); \}/);
assert.ok(actual.indexOf('Source changed before provisioning')<actual.indexOf('fs.openSync'));
const imp='import { snapshot } from "./scripts/market-composition.mjs";';assert.equal(actual.split(imp).length,2);
actual=actual.replace(imp,'const snapshot=()=>({source:process.env.QA461_SOURCE});');
console.log('PASS sole validated artifact binding precedes exclusive/fsynced publication and initdb');
const owned=[];
function directory(){const dir=fs.mkdtempSync('/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/run.QA461');owned.push(dir);validate(dir);return dir;}
const validator=path.resolve('docs/team/evidence/task-379/runtime-path.cjs');
function run(dir,source='qa461',bound=true){return spawnSync('/usr/bin/env',['-i',`PATH=${path.dirname(process.execPath)}:/usr/bin:/bin`,`QA461_SOURCE=${source}`,'/bin/bash','-euc','owned_run="$1"\nnode "$2" "$owned_run"\ntask432_identity=\'{"source":"qa461"}\'\n'+(bound?binding:'')+'\n'+actual,'qa461',dir,validator],{cwd:dir,encoding:'utf8',timeout:5000});}
try{
const missing=directory();let r=run(missing,'qa461',false);assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/undefined\/api-identity.json/);assert.deepEqual(fs.readdirSync(missing),[]);console.log('PASS env-i negative control no inherited artifact env reproduces original ENOENT');
const good=directory();r=run(good);assert.equal(r.status,0,r.stderr);const file=path.join(good,'api-identity.json');const original=fs.statSync(file);assert.equal(original.uid,process.getuid());assert.equal(original.mode&0o777,0o400);assert.equal(fs.readFileSync(file,'utf8'),'{"source":"qa461"}\n');console.log('PASS env-i actual validator + actual binding + inline publication privately publishes exact identity');
r=run(good);assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/EEXIST/);assert.equal(fs.statSync(file).ino,original.ino);assert.equal(fs.readFileSync(file,'utf8'),'{"source":"qa461"}\n');console.log('PASS EEXIST leaves inode and content unchanged');
const drift=directory();r=run(drift,'changed');assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/Source changed before provisioning/);assert.deepEqual(fs.readdirSync(drift),[]);console.log('PASS drift denial before identity file creation');
const invalid=directory();fs.chmodSync(invalid,0o755);r=run(invalid);assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/Require owned 0700 runtime/);assert.deepEqual(fs.readdirSync(invalid),[]);fs.chmodSync(invalid,0o700);console.log('PASS actual validator rejects nonprivate target before publication');
r=spawnSync('/usr/bin/env',['-i','PATH=/usr/bin:/bin','/bin/bash',path.resolve('docs/team/evidence/task-427/runtime.sh')],{encoding:'utf8',timeout:5000});assert.equal(r.status,2);assert.match(r.stderr,/fresh explicit PM sole-owner runtime grant/);console.log('PASS actual whole shell env-i missing grant exit2, before provisioning');
console.log('TOTAL 7 independent source/offline checks PASS; no services');
}finally{for(const dir of owned)fs.rmSync(dir,{recursive:true,force:true});}
