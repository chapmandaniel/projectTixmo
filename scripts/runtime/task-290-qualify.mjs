// Synthetic font/runtime qualification only; no Tixmo, API, DB or provider.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createCDP,deadline,stopOwnedChild,assertListenerClosed} from '../browser/task-280-support.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(root,'docs/evidence/task-290');
const runtime='/home/daniel/projects/projectTixmo/runtime/task-290';
const profile=await mkdtemp(runtime+'/profile-');
const requests=[];let browser,ws,port,stderr='',failure;const results=[];
const html=`<!doctype html><meta charset="utf-8"><style>body{font:20px sans-serif;background:white;color:black}input{font:24px 'UnavailableFont',sans-serif}canvas{border:1px solid black}</style><h1>Wallet session refresh — café £ € Ω Ж</h1><label>Email <input id="email" type="email" placeholder="buyer@example.invalid"></label><p style="font-family:serif">Order confirmed. Tickets and orders</p><dialog open>Transfer ticket <input placeholder="Recipient email"><button>Transfer</button></dialog><canvas width="720" height="100"></canvas><script>window.proof=(async()=>{await document.fonts.ready;let c=document.querySelector('canvas'),x=c.getContext('2d');x.font='24px "UnavailableFont", sans-serif';x.fillText('Wallet café £ € Ω Ж 0123456789',10,50);const pixels=x.getImageData(0,0,c.width,c.height).data;let ink=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])ink++;const widths=['iiii','WWWW','Wallet café £ € Ω Ж'].map(s=>x.measureText(s).width);let external;try{await fetch('http://task290-external.invalid/');external='UNEXPECTED'}catch{external='BLOCKED'}return {ink,widths,external,text:document.body.innerText,font:document.fonts.check('24px "DejaVu Sans"'),refresh:Number(sessionStorage.n||0)};})();</script>`;
const server=createServer((req,res)=>{requests.push(req.url);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)});
try {
 await assertListenerClosed(9);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));port=server.address().port;
 browser=spawn(resolve(root,'scripts/runtime/task-290-chromium'),['--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],detached:true});
 const endpoint=await deadline(new Promise((res,rej)=>{browser.stderr.on('data',d=>{stderr+=d;const m=stderr.match(/DevTools listening on (ws:\/\/\S+)/);if(m)res(m[1]);});browser.once('error',rej);browser.once('exit',(c,s)=>rej(Error('Browser exited '+c+' '+s)));}),12000,'startup');
 const origin=new URL(endpoint);assert.equal(origin.hostname,'127.0.0.1');
 const targets=await fetch('http://'+origin.host+'/json/list',{signal:AbortSignal.timeout(3000)}).then(r=>r.json());
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await deadline(new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})}),3000,'CDP connect');
 const send=createCDP(ws);const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value};
 await send('Page.enable');await send('Runtime.enable');
 for(let i=0;i<4;i++){
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/?refresh='+i});
  let ready=false;for(let j=0;j<60;j++){if(await evaluate('!!window.proof')){ready=true;break}await new Promise(r=>setTimeout(r,50));}assert(ready);
  const proof=await evaluate('window.proof');assert(proof.ink>300);assert(proof.widths[1]>proof.widths[0]*2);assert.equal(proof.external,'BLOCKED');assert(proof.text.includes('Wallet session refresh — café'));assert(proof.font);
  await evaluate("document.querySelector('#email').focus()");
  await send('Input.insertText',{text:'buyer@example.invalid'});assert.equal(await evaluate("document.querySelector('#email').value"),'buyer@example.invalid');
  // Exercise default/unavailable-family fallback on focused email input, then repaint.
  await evaluate("document.querySelector('dialog').close(); document.querySelector('h1').textContent='Session expired — sign in again';sessionStorage.n=String(Number(sessionStorage.n||0)+1)");
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,'render-'+i+'.png'),Buffer.from(shot.data,'base64'));results.push(proof);
 }
 assert(!/SIGTRAP|FontConfigInterface|Fontconfig error|FATAL/.test(stderr),stderr);
} catch(e){failure=e.stack} finally {
 if(ws)ws.close();const cleanup={};const errors=[];
 try{cleanup.browser=await stopOwnedChild(browser);
  const remaining=[];for(const pid of await readdir('/proc')){if(!/^\d+$/.test(pid))continue;try{const stat=(await readFile('/proc/'+pid+'/stat','utf8')).split(')').slice(1).join(')').trim().split(/\s+/);if(Number(stat[2])===browser.pid && stat[0]!=='Z')remaining.push(pid)}catch(e){if(!['ENOENT','ESRCH','EACCES'].includes(e.code))throw e}}
  cleanup.liveProcessGroupMembers=remaining;assert.equal(remaining.length,0);
 }catch(e){errors.push(e.message)}
 try{await deadline(new Promise(r=>server.close(r)),3000,'server close');if(port)cleanup.listener=await assertListenerClosed(port)}catch(e){errors.push(e.message)}
 try{await rm(profile,{recursive:true,force:true});cleanup.profileRemoved=true}catch(e){errors.push(e.message)}
 await writeFile(resolve(out,'browser-stderr.txt'),stderr);
 await writeFile(resolve(out,'result.json'),JSON.stringify({status:failure||errors.length?'FAIL':'PASS synthetic font/runtime only; NOT actual App acceptance',results,requests,cleanup,errors,failure,networkBoundary:'Application-level dead proxy/exact127.0.0.1 bypass/DNS failure; NOT kernel isolation'},null,2)+'\n');
 if(failure||errors.length)throw Error(failure||errors.join(';'));
}
console.log('PASS: four real headless JS/font raster/measurement/input fallback/refresh renders and cleanup');
