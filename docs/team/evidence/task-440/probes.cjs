const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const validate=require('../task-426/runtime-path.cjs').validate;
let count=0;for(const bad of ['/tmp/run.foo','/dev/shm/run.foo','/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/run.foo','/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task426-abort/../run.foo']){assert.throws(()=>validate(bad),/Invalid runtime location/);count++;}
const source=fs.readFileSync('tixmoapi2/tests/qualification/orders-http-abort.local.ts','utf8');
const start=source.indexOf('    fs.writeFileSync(');const end=source.indexOf('\n    try { if (server.listening)',start);
let writes=0;assert.throws(()=>vm.runInNewContext(source.slice(start,end),{fs:{writeFileSync(){writes++;throw Error('injected ENOSPC');}},path:require('node:path'),artifact:'/synthetic',rows:[],requested:0,aborted:0,settled:0,performance:{now:()=>1},started:0}),/ENOSPC/);assert.equal(writes,1);count++;
assert.match(source,/await closed;\n\s+gate.resolve\(\)/);assert.match(source,/socket!\.once\('close'/);count++;
assert.match(source,/await new Promise<void>\(\(resolve, reject\) => server.close/);count++;
const schema=fs.readFileSync('tixmoapi2/prisma/schema.prisma','utf8');const ticket=schema.slice(schema.indexOf('model TicketType {'),schema.indexOf('\n}',schema.indexOf('model TicketType {')));assert.match(ticket,/updatedAt[^\n]+@updatedAt/);assert.match(source,/ticketType.findUnique[^\n]+toEqual\(baseline.inventory/);count++;
console.log(`PASS ${count} offline probes: four unsafe paths, extracted artifact-write fault, clientclose gate source, unbounded serverclose source, volatile inventory equality source. These identify review defects, NOT HTTP execution.`);
