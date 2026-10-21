// Task-only attribution; no application or service import.
const fs = require('node:fs'), path = require('node:path');
const contextFile = path.join(__dirname, 'context-' + process.pid + '.json');
function context(phase) { const state = expect.getState(); fs.writeFileSync(contextFile, JSON.stringify({ testPath: path.relative(path.resolve(__dirname, '../../../../tixmoapi2'), state.testPath || ''), testName: state.currentTestName || null, phase }), { mode: 0o600 }); }
context('suite-load');
beforeEach(() => context('test'));
afterEach(() => context('after-test'));
afterAll(() => fs.rmSync(contextFile, { force: true }));
