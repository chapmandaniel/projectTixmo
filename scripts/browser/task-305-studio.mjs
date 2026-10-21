// Actual App -> owned real API; transport interception only blocks non-allowed requests.
import { createWriteStream } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createCDP, deadline, cleanupOwned } from './task-305-support.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'tdash/package.json'));
const { createServer } = await import(require.resolve('vite'));
const react = (await import(require.resolve('@vitejs/plugin-react'))).default;
const browserPath = process.env.TIXMO_BROWSER_PATH;
assert(browserPath, 'Set TIXMO_BROWSER_PATH to an existing cached Chromium executable; do not download.');
const out = resolve(root, 'docs/team/evidence/task-306-A/browser');
const fixture = JSON.parse(process.env.TASK305_FIXTURE);
const apiOrigin = process.env.TASK305_API_ORIGIN;
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(apiOrigin));
await mkdir(out,{recursive:true});
const profile = await mkdtemp(resolve(process.env.TASK305_RUN, 'browser-profile-'));
let server, browser, ws, send;
const audit = []; const failures = [];
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = async (expression, description) => { for (let i=0;i<100;i++) { if(await evaluate(expression)) return; await new Promise(r=>setTimeout(r,100)); } throw Error(`Timed out: ${description}`); };
const click = text => evaluate(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)}); if(!e)throw Error('Missing control');e.click();})()`);
const captureStates=[];
const screenshot=async(name)=>{
 await evaluate('document.fonts.ready.then(()=>true)');
 let stable=0,previous='';
 for(let i=0;i<60;i++){
  const state=await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Save Draft');const r=b?.getBoundingClientRect();return{fonts:document.fonts.status,text:document.body.textContent.includes('Draft saved.'),geometry:r?[r.x,r.y,r.width,r.height]:null,running:document.getAnimations().filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getTiming().iterations??1)).length};})()`);
  const key=JSON.stringify(state);stable=state.text&&state.fonts==='loaded'&&state.running===0&&key===previous?stable+1:0;previous=key;
  if(stable>=4){captureStates.push({name,...state,stableFrames:stable});break;}await new Promise(r=>setTimeout(r,100));
 }
 assert(stable>=4,'Screenshot not settled');
 await send('Page.bringToFront');await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(resolve(out,`${name}.png`),Buffer.from(shot.data,'base64'));
 await writeFile(resolve(out,'capture-states.json'),JSON.stringify(captureStates,null,2));
};
try {
 const frontendPort=Number(process.env.TASK305_FRONTEND_PORT);assert(frontendPort>0 && frontendPort<65536);
 server = await createServer({configFile:false,envFile:false,envDir:profile,root:resolve(root,'tdash'),plugins:[react(),{name:'task305-entry',configureServer(vite){vite.middlewares.use('/__task305',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/__task305',`<html><body><div id="root"></div><script type="module" src="/task305-entry.jsx"></script></body></html>`));});}}],server:{host:'127.0.0.1',port:frontendPort,strictPort:true,proxy:{'/api':{target:apiOrigin,changeOrigin:true}}}, logLevel:'error'});
 await server.listen(); const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 browser=spawn(browserPath,['--run-all-compositor-stages-before-draw','--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 browser.stderr.pipe(createWriteStream(resolve(out,'browser-stderr.log')));
 const browserWs=await new Promise((res,rej)=>{let s='';browser.stderr.on('data',d=>{s+=d;const m=s.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m)res(m[1]);});browser.once('error',rej);browser.once('exit',c=>rej(Error(`Chromium exited ${c}: ${s.slice(-2000)}`)));setTimeout(()=>rej(Error('Chromium startup timeout')),15000).unref();});
 const debugOrigin=new URL(browserWs); assert(['127.0.0.1','localhost','[::1]'].includes(debugOrigin.hostname),'DevTools must be loopback'); const targets=await fetch(`http://${debugOrigin.host}/json/list`, {signal:AbortSignal.timeout(5000)}).then(r=>r.json());
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await deadline(new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(Error('CDP connection failed')),{once:true});}),5000,'CDP connection'); send=createCDP(ws);
 ws.addEventListener('message',async e=>{const m=JSON.parse(e.data);if(m.id)return;
 if(m.method==='Fetch.requestPaused'){const p=m.params;const u=new URL(p.request.url);
 try {
  if(u.origin!==origin){audit.push({blockedExternal:u.origin});await send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'});return;}
  if(u.pathname.startsWith('/api/')){const path=u.pathname; const method=p.request.method;
   const eventIds=fixture.cases.map(c=>c.event.id);const typeIds=fixture.cases.map(c=>c.typeId);
   const allowed=(method==='PUT' && eventIds.some(id=>path===`/api/v1/events/${id}/configuration`))
    || (method==='POST' && path==='/api/v1/auth/login')
    || (method==='GET' && path==='/api/v1/venues' && u.search==='?limit=100')
    || (method==='GET' && path==='/api/v1/ticket-types' && eventIds.includes(u.searchParams.get('eventId')))
    || (method==='GET' && path==='/api/v1/ticket-tiers' && typeIds.includes(u.searchParams.get('ticketTypeId')))
    || (method==='GET' && eventIds.some(id=>path===`/api/v1/events/${id}`));
   audit.push({method,path,query:u.search,...(method==='PUT'?{body:JSON.parse(p.request.postData)}:{})}); if(!allowed){failures.push(`${method} ${path}`);await send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'});return;}
  }
  await send('Fetch.continueRequest',{requestId:p.requestId});
 }catch(error){failures.push(error.message);}}
 if(m.method==='Network.responseReceived' && m.params.response.url.startsWith(origin+'/api/')) audit.push({responsePath:new URL(m.params.response.url).pathname,status:m.params.response.status});
 });
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__TIXMO_CONFIG__={apiUrl:'/api/v1',stripePublishableKey:''};window.__TASK305=${JSON.stringify(fixture)};`});
 for (const [index,item] of fixture.cases.entries()) {
  await send('Emulation.setTimezoneOverride',{timezoneId:item.zone});
  await send('Page.navigate',{url:`${origin}/__task305?case=${index}`});
  await wait(`(document.body?.textContent||'').includes('Admission') && [...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Save Draft')`,'Studio configuration loaded');
  await click('Save Draft');
  await wait(`(document.body?.textContent||'').includes('Draft saved.')`,'actual configuration HTTP save');
  await screenshot(`studio-${index}`);
 }
 assert.equal(failures.length,0,failures.join('\n'));
 assert.equal(audit.filter(a=>a.method==='PUT').length,9);
 assert.equal(audit.filter(a=>a.responsePath?.endsWith('/configuration')&&a.status===200).length,9);
 await writeFile(resolve(out,'result.json'),JSON.stringify({status:'PASS Studio UI saves only; SQL verified by parent',audit,failures},null,2));
} catch(error) {
 if(send)await writeFile(resolve(out,'failure.json'),JSON.stringify({error:error.stack,audit,failures,body:await evaluate('document.body?.textContent').catch(()=>null)},null,2));
 throw error;
} finally {
 if(ws)ws.close();const proof=await cleanupOwned({child:browser,server,profile,remove:rm});
 await writeFile(resolve(out,'cleanup.json'),JSON.stringify(proof,null,2));console.log('TASK305_BROWSER_CLEANUP',proof);
}
