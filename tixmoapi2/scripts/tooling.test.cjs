const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { build } = require('./build.cjs');
const { watch } = require('./watch.cjs');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for child lifecycle');
    await delay(30);
  }
}
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-tooling-'));
  fs.mkdirSync(path.join(directory, 'src'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('alias compiler preserves executable imports, declarations, JSON and maps', (t) => {
  const directory = fixture(t);
  fs.mkdirSync(path.join(directory, 'src/nested'));
  fs.writeFileSync(path.join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', rootDir: 'src', outDir: 'dist',
    declaration: true, declarationMap: true, sourceMap: true, resolveJsonModule: true, esModuleInterop: true,
    baseUrl: 'src', paths: { '@/*': ['*'] }, types: [],
  }, include: ['src/**/*'] }));
  fs.writeFileSync(path.join(directory, 'src/value.ts'), 'export const value = 7; export type Value = number;');
  fs.writeFileSync(path.join(directory, 'src/common.cts'), 'export const common = 8;');
  fs.writeFileSync(path.join(directory, 'src/module.mts'), 'export const moduleValue = 9;');
  fs.writeFileSync(path.join(directory, 'src/data.json'), '{"label":"fixture"}');
  fs.writeFileSync(path.join(directory, 'src/nested/main.ts'), [
    'import { value } from "@/value";', 'import data from "@/data.json";',
    'import { common } from "@/common.cjs";', 'import { moduleValue } from "@/module.mjs";',
    'import equal = require("@/value");', 'export { value } from "@/value";',
    'export type Value = import("@/value").Value;',
    'export async function result() { const dynamic = await import("@/value"); return [value, equal.value, dynamic.value, data.label, common, moduleValue]; }',
  ].join('\n'));
  assert.equal(build(directory), 0);
  const js = fs.readFileSync(path.join(directory, 'dist/nested/main.js'), 'utf8');
  const declaration = fs.readFileSync(path.join(directory, 'dist/nested/main.d.ts'), 'utf8');
  assert.equal(js.includes('@/'), false);
  assert.equal(declaration.includes('@/'), false);
  for (const name of ['dist/nested/main.js.map', 'dist/nested/main.d.ts.map', 'dist/data.json']) assert.ok(fs.existsSync(path.join(directory, name)));
  const executed = spawnSync(process.execPath, ['-e', 'require("./dist/nested/main.js").result().then(x=>console.log(JSON.stringify(x)))'], { cwd: directory, encoding: 'utf8' });
  assert.equal(executed.status, 0, executed.stderr);
  assert.deepEqual(JSON.parse(executed.stdout), [7, 7, 7, 'fixture', 8, 9]);
});

test('watcher restarts serially for create, edit and delete, ignores tests, and awaits shutdown', async (t) => {
  const directory = fixture(t);
  const journal = path.join(directory, 'journal.jsonl');
  const script = 'const fs=require("node:fs"); const log=x=>fs.appendFileSync(process.argv[1],JSON.stringify({event:x,pid:process.pid,env:process.env.NODE_ENV})+"\\n");log("start");const timer=setInterval(()=>{},1000);process.once("SIGTERM",()=>setTimeout(()=>{log("stop");clearInterval(timer)},60));';
  const entries = () => fs.existsSync(journal) ? fs.readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const starts = () => entries().filter((row) => row.event === 'start').length;
  const supervisor = watch({ directory, args: ['-e', script, journal], debounceMs: 50 });
  t.after(() => supervisor.close());
  await until(() => starts() === 1);
  for (const mutate of [
    () => fs.writeFileSync(path.join(directory, 'src/created.ts'), 'first'),
    () => fs.writeFileSync(path.join(directory, 'src/created.ts'), 'changed'),
    () => fs.unlinkSync(path.join(directory, 'src/created.ts')),
    () => { fs.mkdirSync(path.join(directory, 'src/nested')); fs.writeFileSync(path.join(directory, 'src/nested/data.json'), '{}'); },
    () => fs.renameSync(path.join(directory, 'src/nested'), path.join(directory, 'src/renamed')),
    () => fs.rmSync(path.join(directory, 'src/renamed'), { recursive: true }),
    () => { fs.mkdirSync(path.join(directory, 'src/service.v2')); fs.writeFileSync(path.join(directory, 'src/service.v2/data.json'), '{}'); },
    () => fs.renameSync(path.join(directory, 'src/service.v2'), path.join(directory, 'src/service.v3')),
    () => fs.rmSync(path.join(directory, 'src/service.v3'), { recursive: true }),
    () => fs.renameSync(path.join(directory, 'src'), path.join(directory, 'old-src')),
    () => fs.mkdirSync(path.join(directory, 'src')),
    () => fs.writeFileSync(path.join(directory, 'src/restored.ts'), 'restored'),
    () => fs.rmSync(path.join(directory, 'src'), { recursive: true }),
    () => fs.mkdirSync(path.join(directory, 'src')),
  ]) {
    const previous = starts(); mutate(); await until(() => starts() === previous + 1);
  }
  fs.writeFileSync(path.join(directory, 'src/ignored.test.ts'), 'ignored');
  fs.writeFileSync(path.join(directory, 'src/ignored.txt'), 'ignored');
  await delay(200);
  assert.equal(starts(), 15);
  await supervisor.close();
  const rows = entries();
  assert.equal(rows.length, 30);
  rows.forEach((row, index) => assert.equal(row.event, index % 2 === 0 ? 'start' : 'stop'));
  rows.filter((row) => row.event === 'start').forEach((row) => assert.equal(row.env, 'development'));
  for (let index = 0; index < rows.length; index += 2) assert.equal(rows[index].pid, rows[index + 1].pid);
});
