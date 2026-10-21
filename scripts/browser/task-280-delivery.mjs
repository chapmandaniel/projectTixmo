// Loopback-only actual-App delivery rehearsal. No API server, DB, provider or email.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'tdash/package.json'));
const { createServer } = await import(require.resolve('vite'));
const react = (await import(require.resolve('@vitejs/plugin-react'))).default;
const browserPath = process.env.TIXMO_BROWSER_PATH;
assert(browserPath, 'Set TIXMO_BROWSER_PATH to an existing cached Chromium executable; do not download.');
const out = resolve(root, 'docs/evidence/task-280');
const profile = await mkdtemp(resolve(tmpdir(), 'tixmo-280-'));
let server, browser, ws; let next = 0; const pending = new Map();
const audit = []; const failures = []; let expired = false; let buyer = 'A';
const user = name => ({ id: `synthetic-${name}`, email: `buyer-${name.toLowerCase()}@example.invalid`, role: 'BUYER' });
const order = { id: 'synthetic-order', eventId: 'synthetic-event', orderNumber: 'SYNTHETIC-A-ONLY', status: 'PAID', totalAmount: 25, currency: 'cad', refundStatus: 'NONE', event: { name: 'Synthetic delivery rehearsal' } };
const ticket = { id: 'synthetic-ticket', status: 'VALID', event: order.event, ticketType: { name: 'Synthetic admission' }, order };
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next; pending.set(id, {resolve,reject}); ws.send(JSON.stringify({id, method, params})); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = async (expression, description) => { for (let i=0;i<100;i++) { if(await evaluate(expression)) return; await new Promise(r=>setTimeout(r,100)); } throw Error(`Timed out: ${description}`); };
const click = text => evaluate(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)}); if(!e)throw Error('Missing control');e.click();})()`);
const fill = (label,value) => evaluate(`(()=>{const e=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const screenshot = async name => { const shot = await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true}); await writeFile(resolve(out, `${name}.png`),Buffer.from(shot.data,'base64')); };
const login = async name => { buyer=name; expired=false; await click('Sign in'); await fill('Email address',user(name).email); await fill('Password','synthetic-password-only'); await click('Sign in for checkout'); };
try {
 const portProbe=createNetServer(); await new Promise(r=>portProbe.listen(0,'127.0.0.1',r)); const frontendPort=portProbe.address().port; await new Promise(r=>portProbe.close(r));
 server = await createServer({configFile:false,envFile:false,envDir:profile,root:resolve(root,'tdash'),plugins:[react()],server:{host:'127.0.0.1',port:frontendPort,strictPort:true,proxy:{}}, logLevel:'error'});
 await server.listen(); const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 browser=spawn(browserPath,['--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const browserWs=await new Promise((res,rej)=>{let s='';browser.stderr.on('data',d=>{s+=d;const m=s.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m)res(m[1]);});browser.once('exit',c=>rej(Error(`Chromium exited ${c}: ${s.slice(-2000)}`)));setTimeout(()=>rej(Error('Chromium startup timeout')),15000).unref();});
 const debugOrigin=new URL(browserWs); const targets=await fetch(`http://${debugOrigin.host}/json/list`).then(r=>r.json());
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',async e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);return;}
 if(m.method==='Fetch.requestPaused'){try{const p=m.params;const u=new URL(p.request.url);if(u.origin!==origin){audit.push({blockedExternal:u.origin});await send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'});return;}
 if(!u.pathname.startsWith('/api/v1/')) {await send('Fetch.continueRequest',{requestId:p.requestId});return;}
 const path=u.pathname.slice(7);const token=p.request.headers.Authorization || p.request.headers.authorization || '';audit.push({method:p.request.method,path,token});let status=200;let data;
 if(path.startsWith('/events/public/'))data={id:'synthetic-event',name:'Synthetic delivery rehearsal',startDate:'2027-11-09T20:00:00Z',timezone:'America/St_Johns',ticketTypes:[]};
 else if(path==='/auth/login')data={accessToken:`synthetic-${buyer}`,refreshToken:`synthetic-refresh-${buyer}`,user:user(buyer)};
 else if(path==='/auth/refresh'){status=401;data={};}
 else if(expired){status=401;data={};}
 else if(path==='/orders/synthetic-order'){if(token==='Bearer synthetic-A')data=order;else {status=403;data={};}}
 else if(path.startsWith('/orders/mine'))data={orders:token==='Bearer synthetic-A'?[order]:[],pagination:{pages:1}};
 else if(path.startsWith('/tickets/mine'))data={tickets:token==='Bearer synthetic-A'?[ticket]:[],pagination:{pages:1}};
 else if(path==='/tickets/synthetic-ticket/qr')data={qrCode:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="white"/><text x="10" y="90">SYNTHETIC QR</text></svg>')};
 else{status=500;failures.push(`Unhandled synthetic API: ${path}`);data={};}
 await send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({success:status===200,data,message:status===401?'Synthetic session expired':undefined})).toString('base64')});
 }catch(error){failures.push(error.message);}}
 });
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__TIXMO_CONFIG__={apiUrl:'/api/v1',stripePublishableKey:''}; if(!sessionStorage.getItem('synthetic-seeded')){localStorage.clear();localStorage.setItem('access_token','synthetic-A');localStorage.setItem('refresh_token','synthetic-refresh-A');localStorage.setItem('user',${JSON.stringify(JSON.stringify(user('A')))});localStorage.setItem('tixmo_session_generation','synthetic-A-generation');sessionStorage.setItem('synthetic-seeded','yes');}`});
 await send('Page.navigate',{url:`${origin}/wallet`});
 await wait(`document.body.innerText.includes('SYNTHETIC-A-ONLY')`,'A wallet');await click('Show ticket');await wait(`!!document.querySelector('img[alt="Ticket admission QR code"]')`,'synthetic QR');await click('Transfer');await screenshot('01-a-wallet-qr-transfer');
 expired=true;await click('Refresh');await wait(`!!document.querySelector('[aria-label="Email address"]')`,'actual 401 refresh failure recovery');
 assert.equal(await evaluate(`location.pathname`),'/wallet');assert.equal(await evaluate(`document.body.innerText.includes('SYNTHETIC-A-ONLY') || !!document.querySelector('img[alt="Ticket admission QR code"]') || !!document.querySelector('[role="dialog"]')`),false);
 assert.equal(await evaluate(`localStorage.getItem('access_token')`),null);await screenshot('02-wallet-expired-cleared');
 await login('B');await wait(`document.body.innerText.includes('buyer-b@example.invalid') && document.body.innerText.includes('No tickets yet.')`,'B wallet');assert.equal(await evaluate(`document.body.innerText.includes('SYNTHETIC-A-ONLY')`),false);await screenshot('03-b-wallet-isolated');
 // Return begins with expired A credentials; actual interceptor must preserve URL and reauthentication.
 await evaluate(`localStorage.setItem('access_token','synthetic-A');localStorage.setItem('refresh_token','synthetic-refresh-A');localStorage.setItem('user',${JSON.stringify(JSON.stringify(user('A')))});localStorage.setItem('tixmo_session_generation','synthetic-return-A');`);expired=true;
 await send('Page.navigate',{url:`${origin}/checkout/synthetic?orderId=synthetic-order&redirect_status=succeeded`});
 await wait(`!!document.querySelector('[aria-label="Email address"]') && !localStorage.getItem('access_token')`,'return expiry');assert.equal(await evaluate(`new URLSearchParams(location.search).get('orderId')`),'synthetic-order');await screenshot('04-return-expired-preserved');
 await login('A');await wait(`document.body.innerText.includes('Order confirmed.')`,'server-confirmed return');await screenshot('05-confirmed-wallet-link');await click('View my tickets and orders');await wait(`location.pathname==='/wallet' && document.body.innerText.includes('SYNTHETIC-A-ONLY')`,'wallet link delivered');await screenshot('06-delivered-wallet');
 assert(audit.some(r=>r.path==='/auth/refresh'));assert(audit.some(r=>r.path?.startsWith('/tickets/mine')&&r.token==='Bearer synthetic-B'));assert.equal(failures.length,0,failures.join('\n'));
 await writeFile(resolve(out,'result.json'),JSON.stringify({status:'PASS synthetic rendered browser only',candidate:'4ec8594850eb547dafc145a14bb1b85cdeaa235c',browser:browserPath,audit,failures},null,2));
 console.log('PASS: rendered wallet expiry, account isolation, return expiry URL retention, confirmed return wallet link. Synthetic API only.');
} finally {
 if(ws){ws.close();} if(browser){browser.kill('SIGTERM');await new Promise(r=>browser.exitCode!==null?r():browser.once('exit',r));console.log('Browser stopped:',browser.exitCode,browser.signalCode);}
 if(server){const port=server.httpServer.address()?.port;await server.close(); console.log('Frontend server stopped:',port);}
 await rm(profile,{recursive:true,force:true});
}
