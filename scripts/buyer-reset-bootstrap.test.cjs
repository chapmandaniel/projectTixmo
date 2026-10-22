// Pure VM execution of the parser-blocking bootstrap; no browser or services.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync('tdash/public/buyer-reset-intent.js','utf8');
const html = readFileSync('tdash/index.html','utf8');
test('same-origin parser-blocking capture precedes other application assets without weakening CSP', () => {
  assert.ok(html.indexOf('src="/buyer-reset-intent.js"') < html.indexOf('rel="icon"'));
  assert.ok(html.indexOf('src="/buyer-reset-intent.js"') < html.indexOf('src="/runtime-config.js"'));
  assert.doesNotMatch(source, /localStorage|sessionStorage|fetch|console|XMLHttpRequest/);
  const csp = readFileSync('tdash/nginx.security-headers.conf','utf8');
  assert.doesNotMatch(csp.match(/script-src[^;]+/)[0], /unsafe-inline/);
});
for(const hash of ['#token='+'a'.repeat(64),'#token=bogus','#token='+'a'.repeat(64)+'&token='+'b'.repeat(64)]) test('bootstrap removes complete recovery URL fragment and query with bounded memory intent', () => {
  let replaced;
  const window = { location: { pathname:'/reset-password',search:'?unexpected=true',hash },history:{state:{},replaceState:(_state,_title,path)=>{replaced=path;}} };
  vm.runInNewContext(source,{window,URLSearchParams});
  assert.equal(replaced,'/reset-password');
  assert.equal(window.__TIXMO_BUYER_RESET_INTENT__,hash==='#token='+'a'.repeat(64)?'a'.repeat(64):'');
});
test('ordinary routes do not collect or change location fragments',()=>{
  const window={location:{pathname:'/wallet',hash:'#ordinary'},history:{replaceState:()=>assert.fail('Unexpected navigation')}};
  vm.runInNewContext(source,{window,URLSearchParams});assert.equal(window.__TIXMO_BUYER_RESET_INTENT__,undefined);
});
