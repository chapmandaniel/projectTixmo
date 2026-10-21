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
import { createCDP, deadline, cleanupOwned, stopOwnedChild } from './task-294-support.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'tdash/package.json'));
const { createServer } = await import(require.resolve('vite'));
const react = (await import(require.resolve('@vitejs/plugin-react'))).default;
const browserPath = process.env.TIXMO_BROWSER_PATH;
assert(browserPath, 'Set TIXMO_BROWSER_PATH to an existing cached Chromium executable; do not download.');
const out = resolve(root, 'docs/team/evidence/task-314/browser');
const fixture = JSON.parse(process.env.TASK294_FIXTURE);
const apiOrigin = process.env.TASK294_API_ORIGIN;
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(apiOrigin));
await mkdir(out,{recursive:true});
const profile = await mkdtemp(resolve(process.env.TASK294_RUN, 'browser-profile-'));
let server, browser, ws, send;
const audit = []; const failures = [];
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = async (expression, description) => { for (let i=0;i<100;i++) { if(await evaluate(expression)) return; await new Promise(r=>setTimeout(r,100)); } throw Error(`Timed out: ${description}`); };
const click = text => evaluate(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)}); if(!e)throw Error('Missing control');e.click();})()`);
const fill = (label,value) => evaluate(`(()=>{const e=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const captureStates = [];
const screenshot = async name => {
 const authFrame=['02-real-session-cleared','04-real-signedout-return','05-real-return-expired'].includes(name);
 const expected=name==='03-real-b-reload-isolated' ? ['No tickets yet.','No orders yet.',fixture.b]
  : name==='06-real-confirmed-wallet-link' ? ['Order confirmed. Payment succeeded.','View my tickets and orders']
  : ['04-real-signedout-return','05-real-return-expired'].includes(name) ? ['Sign in to check your order. Payment has not been verified.']
  : name==='02-real-session-cleared' ? ['Sign in to view tickets, payment status, and refunds.','New buyer'] : name==='failure' ? [] : [fixture.orderNumber];
 const selector=authFrame ? '[aria-label="Email address"],h1' : ['01-real-a-wallet-qr','07-real-delivered-wallet-qr'].includes(name) ? 'h1,img[alt="Ticket admission QR code"]' : 'h1';
 await evaluate('document.fonts.ready.then(()=>true)');
 let previous='',stable=0,state;
 for(let attempt=0;attempt<60;attempt++){
  state=await evaluate(`(()=>{const text=document.body?.textContent||'';const nodes=[...document.querySelectorAll(${JSON.stringify(selector)})];let minOpacity=1;let visible=nodes.length>0;const geometry=[];for(const node of nodes){const r=node.getBoundingClientRect();visible=visible&&r.width>0&&r.height>0;geometry.push([r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10));for(let e=node;e;e=e.parentElement){const c=getComputedStyle(e);minOpacity=Math.min(minOpacity,Number(c.opacity));visible=visible&&c.display!=='none'&&c.visibility!=='hidden';}}const running=document.getAnimations().filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getTiming().iterations??1)).length;return{expected:${JSON.stringify(expected)}.every(t=>text.includes(t)),visible,minOpacity,running,geometry,fonts:document.fonts.status};})()`);
  const key=JSON.stringify(state.geometry);stable=state.expected&&state.visible&&state.minOpacity>=.95&&state.running===0&&state.fonts==='loaded'&&key===previous ? stable+1:0;previous=key;
  if(stable>=4)break;await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert(stable>=4,`Unsettled screenshot ${name}: ${JSON.stringify(state)}`);
 captureStates.push({name,expectedText:expected,selector,...state,stableFrames:stable});
 await send('Page.bringToFront');
 await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(resolve(out,`${name}.png`),Buffer.from(shot.data,'base64'));
 await writeFile(resolve(out,'capture-states.json'),JSON.stringify(captureStates,null,2));
};
const login = async name => { await click('Sign in'); await fill('Email address',fixture[name]); await fill('Password',fixture.password); await click('Sign in for checkout'); };
const revoke = () => new Promise((resolve,reject)=>{process.once('message',m=>m.ok?resolve():reject(Error(m.error)));process.send({revoke:true});});
try {
 const frontendPort=Number(process.env.TASK294_FRONTEND_PORT);assert(frontendPort>0 && frontendPort<65536);
 server = await createServer({configFile:false,envFile:false,envDir:profile,root:resolve(root,'tdash'),plugins:[react()],server:{host:'127.0.0.1',port:frontendPort,strictPort:true,proxy:{'/api':{target:apiOrigin,changeOrigin:true}}}, logLevel:'error'});
 await server.listen(); const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 const openBrowser = async () => {
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
   const allowed=(method==='GET' && (path.startsWith('/api/v1/tickets/')||path.startsWith('/api/v1/orders/')||path.startsWith('/api/v1/events/public/'))) || (method==='POST' && ['/api/v1/auth/login','/api/v1/auth/refresh'].includes(path));
   audit.push({method,path}); if(!allowed){failures.push(`${method} ${path}`);await send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'});return;}
  }
  await send('Fetch.continueRequest',{requestId:p.requestId});
 }catch(error){failures.push(error.message);}}
 if(m.method==='Network.responseReceived' && m.params.response.url.startsWith(origin+'/api/')) audit.push({responsePath:new URL(m.params.response.url).pathname,status:m.params.response.status});
 });
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__TIXMO_CONFIG__={apiUrl:'/api/v1',stripePublishableKey:''};`});
 };
 await openBrowser();
 await send('Page.navigate',{url:`${origin}/wallet`});
 await wait(`!!document.querySelector('[aria-label="Email address"]')`,'initial unauthenticated wallet');
 await login('a');
 await wait(`(document.body?.textContent || '').includes(${JSON.stringify(fixture.orderNumber)})`,'real A wallet');
 await click('Show ticket');await wait(`!!document.querySelector('img[alt="Ticket admission QR code"]')`,'real QR image');
 assert.match(await evaluate(`document.querySelector('img[alt="Ticket admission QR code"]').src`),/^data:image\/png;base64,/);
 await screenshot('01-real-a-wallet-qr');
 const reopen = async (path) => {
  const oldPid=browser.pid; const before=await evaluate('performance.timeOrigin');
  await send('Browser.close').catch(()=>{}); await stopOwnedChild(browser,3000);ws.close();
  audit.push({actualBrowserClosed:oldPid,profilePreserved:true});
  await openBrowser();assert.notEqual(browser.pid,oldPid);
  await send('Page.navigate',{url:origin+path});
  await wait(`(document.body?.textContent || '').includes(${JSON.stringify(fixture.orderNumber)})`,'A restored after actual browser close');
  assert((await evaluate('performance.timeOrigin'))>before);
  audit.push({actualBrowserReopened:browser.pid,path,ownerRestored:true});
 };
 await reopen('/wallet');await screenshot('02b-real-a-recovered');
 const confirmedPath=`/checkout/${fixture.slug}?orderId=${fixture.orderId}&redirect_status=succeeded`;
 await send('Page.navigate',{url:origin+confirmedPath});
 await wait(`(document.body?.textContent || '').includes('Order confirmed. Payment succeeded.')`,'confirmed A return');
 // Reopen helper waits for orderNumber, which checkout confirmation does not render.
 const oldPid=browser.pid;await send('Browser.close').catch(()=>{});await stopOwnedChild(browser,3000);ws.close();
 audit.push({actualBrowserClosed:oldPid,profilePreserved:true,confirmedPath});
 await openBrowser();assert.notEqual(browser.pid,oldPid);
 await send('Page.navigate',{url:origin+confirmedPath});
 await wait(`(document.body?.textContent || '').includes('Order confirmed. Payment succeeded.')`,'confirmed return restored after process closure');
 assert.equal(await evaluate(`new URLSearchParams(location.search).get('orderId')`),fixture.orderId);
 audit.push({actualBrowserReopened:browser.pid,confirmedCandidatePreserved:true});
 await screenshot('06-real-confirmed-wallet-link');await click('View my tickets and orders');
 await wait(`location.pathname==='/wallet' && (document.body?.textContent || '').includes(${JSON.stringify(fixture.orderNumber)})`,'owned wallet delivery');
 await evaluate('localStorage.clear()');await send('Page.navigate',{url:origin+'/wallet'});
 await wait(`!!document.querySelector('[aria-label="Email address"]')`,'signed out before B');await login('b');
 await wait(`(document.body?.textContent || '').includes(${JSON.stringify(fixture.b)}) && (document.body?.textContent || '').includes('No tickets yet.') && (document.body?.textContent || '').includes('No orders yet.')`,'B isolation');
 assert.equal(await evaluate(`(document.body?.textContent || '').includes(${JSON.stringify(fixture.orderNumber)}) || !!document.querySelector('img[alt="Ticket admission QR code"]')`),false);
 await screenshot('03-real-b-reload-isolated');
 assert.equal(audit.filter(e=>e.method==='POST'&&!['/api/v1/auth/login','/api/v1/auth/refresh'].includes(e.path)).length,0);assert.equal(failures.length,0);
 await writeFile(resolve(out,'result.json'),JSON.stringify({status:'PASS target A actual browser process close/reopen wallet and confirmed URL, B isolation only',candidate:'4ec8594850eb547dafc145a14bb1b85cdeaa235c',audit,failures,limitations:['B native elapsed expiry not exercised','C receipt capture not exercised','No inbox/device/provider/recovery SLA acceptance']},null,2));
 console.log('TASK314_TARGET_A_PASS');
} catch(error) {
 if(send){try{await writeFile(resolve(out,'failure.json'),JSON.stringify({error:error.stack,audit,failures,body:await evaluate("document.body?.textContent").catch(()=>null)},null,2));await screenshot('failure');}catch{}}throw error;
} finally {
 if(ws)ws.close();const proof=await cleanupOwned({child:browser,server,profile,remove:rm});
 await writeFile(resolve(out,'cleanup.json'),JSON.stringify(proof,null,2));console.log('TASK294_BROWSER_CLEANUP',proof);
}
