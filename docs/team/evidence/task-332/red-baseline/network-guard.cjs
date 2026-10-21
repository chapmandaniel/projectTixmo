const fs=require('node:fs');
const net=require('node:net'); const tls=require('node:tls');
function block(host,kind){host=String(host||'localhost').toLowerCase();if(['localhost','127.0.0.1','::1','[::1]'].includes(host))return;
fs.appendFileSync(process.env.TASK332_BLOCK_LOG,JSON.stringify({pid:process.pid,kind,host})+'\n');throw Error('TASK332_NONLOOPBACK_BLOCKED '+kind+' '+host);}
const original=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...a){let o=a[0];if(Array.isArray(o))o=o[0];if(typeof o==='object'&&o!==null){if(!o.path)block(o.host||o.hostname,'net');}else if(typeof o==='number')block(typeof a[1]==='string'?a[1]:'localhost','net');else if(typeof o==='string'&&!o.startsWith('/'))block(o,'net-unknown');return original.apply(this,a);};
const origTls=tls.connect;tls.connect=function(...a){let o=a.find(x=>x&&typeof x==='object')||{};block(o.host||o.hostname||(typeof a[1]==='string'?a[1]:'localhost'),'tls');return origTls.apply(this,a);};
for(const protocol of ['http','https']){const m=require('node:'+protocol);for(const name of ['request','get']){const orig=m[name];m[name]=function(...a){let o=a[0];if(typeof o==='string'||o instanceof URL)block(new URL(o).hostname,protocol);else block(o?.hostname||o?.host,protocol);return orig.apply(this,a);};}}
if(global.fetch){const orig=global.fetch;global.fetch=function(u,...a){block(new URL(typeof u==='string'||u instanceof URL?u:u.url).hostname,'fetch');return orig.call(this,u,...a);};}
