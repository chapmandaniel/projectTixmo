// Pure TypeScript syntax/fixture-scope inspection; never imports app or Jest setup.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('../../../../tixmoapi2/node_modules/typescript');
const file = 'tixmoapi2/tests/integration/approvals.test.ts';
const source = fs.readFileSync(file, 'utf8');
const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
assert.deepEqual((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error), []);
const name = 'requires owner or admin curation before approved image assets enter the library';
const fixture = source.slice(source.indexOf("it('" + name));
assert.equal((source.match(/jest.spyOn\(uploadService, 'deleteFile'\)/g) || []).length, 1);
for (const value of ["expect(forbiddenResponse.status).toBe(403)","expect(promoteResponse.status).toBe(200)","expect(archiveResponse.status).toBe(200)","expect(deleteResponse.status).toBe(200)","expect(deleteFileSpy).toHaveBeenCalledTimes(1)","expect(deleteFileSpy).toHaveBeenNthCalledWith(1, s3Key)",'deleteFileSpy.mockRestore()']) assert(fixture.includes(value));
console.log('PASS TypeScript transpile syntax and source-scope checks only; no Jest/app/database/network executed');
