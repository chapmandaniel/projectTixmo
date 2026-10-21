'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = path.resolve('tixmoapi2/tests/qualification/orders-http-abort.local.ts');
const dependencyRoot = '/home/daniel/projects/projectTixmo/worktrees/task-434/tixmoapi2';
for (const file of ['package.json', 'package-lock.json', 'prisma/schema.prisma']) {
  assert.deepEqual(fs.readFileSync(path.join('tixmoapi2', file)), fs.readFileSync(path.join(dependencyRoot, file)), 'exact existing dependency/schema provenance: ' + file);
}
const ts = require(path.join(dependencyRoot, 'node_modules/typescript'));
const text = fs.readFileSync(source, 'utf8');
const result = ts.transpileModule(text, { fileName: source, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: true } });
assert.equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics));
new (require('node:vm').Script)(result.outputText, { filename: source }); // Parse only; no import/evaluation.
const validate = require('./runtime-path.cjs').validate;
for (const bad of ['/tmp/run.foo', '/dev/shm/run.foo', '/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379/run.foo', '/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task426-abort/../run.foo']) assert.throws(() => validate(bad), /Invalid runtime location/);
assert.match(text, /before-acquire.*after-acquire.*controller/);
assert.match(text, /expect\(after\)\.toEqual\(baseline\)/);
assert.match(text, /removal\.mock\.calls\.filter\(call => call\[1\] === token\)\)\.toHaveLength\(1\)/);
assert.match(text, /socket\.destroy\(\); aborted\+\+/);
assert.match(text, /requested: 4, aborted: 3, settled: 3/);
console.log('PASS exact package/lock/schema match; TypeScript syntax transpile + emitted JS parse; 4 unsafe runtime paths rejected; checkpoint invariant checks. NOT typecheck/Jest/HTTP/runtime. TypeScript=' + ts.version);
