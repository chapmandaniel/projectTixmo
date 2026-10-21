import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createApiReceiptTransport,collectApiReceipts,apiCommands} from '../../../../scripts/api-receipt-transport.mjs';
const root=path.resolve(import.meta.dirname,'../../../..'), parent='/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379';
const identity={source:'independent439',sourceHash:'fixture'};let count=0;
for(const mutation of ['index','args','cwd','identity','raw','extra','gap','mode','after-failure']){
 const directory=fs.mkdtempSync(path.join(parent,'run.'));fs.chmodSync(directory,0o700);
 try{const write=createApiReceiptTransport({directory,root,identity});for(const [i,[command,args,cwd]] of apiCommands.entries())write({command,args,cwd:path.resolve(root,cwd),started:'fixture',status:mutation==='after-failure'&&i===0?7:0,stdout:'raw\0'+i,stderr:''});
 const file=path.join(directory,'api-1.json');const item=JSON.parse(fs.readFileSync(file));
 if(mutation==='index')item.index=88;if(mutation==='args')item.args=['forged'];if(mutation==='cwd')item.cwd='/';if(mutation==='identity')item.identity.source='stale';if(mutation==='raw')item.stdout+='tamper';
 if(['index','args','cwd','identity','raw'].includes(mutation)){fs.chmodSync(file,0o600);fs.writeFileSync(file,JSON.stringify(item));}
 if(mutation==='extra')fs.copyFileSync(file,path.join(directory,'api-5.json'));if(mutation==='gap')fs.unlinkSync(path.join(directory,'api-2.json'));if(mutation==='mode')fs.chmodSync(file,0o644);
 assert.throws(()=>collectApiReceipts({directory,root,identity,status:mutation==='after-failure'?1:0}));count++;
 }finally{fs.rmSync(directory,{recursive:true});}
}
console.log(`PASS independent ${count} transport mutation denials: index,args,cwd,identity,raw,extra,gap,mode,after-failure.`);
