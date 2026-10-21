import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {verifyApi} from '../../../../scripts/verify-api.mjs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.TASK379_ARTIFACT_DIR;
const requirePath=(await import('node:module')).createRequire(import.meta.url);
requirePath('../task-379/runtime-path.cjs').validate(root);
const dir=pathToFileURL(root+path.sep);let n=0;
verifyApi({spawn(command,args,opts){n++;if(command==='npm'&&args.includes('test'))args=[...args,'--json','--outputFile='+new URL('jest-result.json',dir).pathname];fs.appendFileSync(new URL('commands.jsonl',dir),JSON.stringify({command,args,cwd:opts.cwd})+'\n');const out=fs.openSync(new URL(n+'-stdout.log',dir),'w'),err=fs.openSync(new URL(n+'-stderr.log',dir),'w');const r=spawnSync(command,args,{...opts,stdio:['ignore',out,err]});fs.closeSync(out);fs.closeSync(err);fs.appendFileSync(new URL('commands.jsonl',dir),JSON.stringify({step:n,status:r.status,signal:r.signal})+'\n');return r;}});
if(fs.existsSync(process.env.TASK427_BLOCK_LOG)&&fs.statSync(process.env.TASK427_BLOCK_LOG).size)throw Error('Blocked outbound calls: guarded gate FAIL, inspect blocked-network.jsonl');
