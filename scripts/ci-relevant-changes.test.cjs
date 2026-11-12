// Offline contract for required-check change detection. Never talks to GitHub.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const script = path.resolve(__dirname, 'ci-relevant-changes.sh');
const market = fs.readFileSync(
  path.join(__dirname, '../.github/workflows/market-readiness-local.yml'),
  'utf8'
);
const tdash = fs.readFileSync(
  path.join(__dirname, '../.github/workflows/tdash-design-system.yml'),
  'utf8'
);
const soak = fs.readFileSync(
  path.join(__dirname, '../.github/workflows/http-soak-qualification.yml'),
  'utf8'
);

function run(env, args, cwd) {
  const outputFile = path.join(
    os.tmpdir(),
    `t96-out-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  fs.writeFileSync(outputFile, '');
  const result = spawnSync('bash', [script, ...args], {
    cwd: cwd || process.cwd(),
    env: { ...process.env, GITHUB_OUTPUT: outputFile, ...env },
    encoding: 'utf8',
  });
  const output = fs.readFileSync(outputFile, 'utf8');
  fs.rmSync(outputFile, { force: true });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, output };
}

test('workflow_dispatch and push always report relevant=true', () => {
  for (const event of ['workflow_dispatch', 'push']) {
    const result = run({ GITHUB_EVENT_NAME: event }, ['tdash']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.output, /^relevant=true$/m);
    assert.match(result.stdout, /Full coverage/);
  }
});

test('pull_request without SHAs fails closed', () => {
  const result = run({ GITHUB_EVENT_NAME: 'pull_request' }, ['tdash']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BASE_SHA and HEAD_SHA/);
  assert.equal(result.output, '');
});

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('docs-only PR diff is not relevant; matching paths and the workflow file are', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't96-relevant-'));
  try {
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 't96@tixmo.test']);
    git(dir, ['config', 'user.name', 'T96']);
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.mkdirSync(path.join(dir, 'tdash'));
    fs.mkdirSync(path.join(dir, '.github/workflows'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs/a.md'), 'base\n');
    fs.writeFileSync(path.join(dir, 'tdash/app.js'), 'base\n');
    fs.writeFileSync(
      path.join(dir, '.github/workflows/tdash-design-system.yml'),
      'base\n'
    );
    git(dir, ['add', '.']);
    git(dir, ['commit', '-qm', 'base']);
    const base = git(dir, ['rev-parse', 'HEAD']);

    fs.writeFileSync(path.join(dir, 'docs/a.md'), 'docs only\n');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-qm', 'docs']);
    const docsHead = git(dir, ['rev-parse', 'HEAD']);
    const docs = run(
      { GITHUB_EVENT_NAME: 'pull_request', BASE_SHA: base, HEAD_SHA: docsHead },
      ['tdash', '.github/workflows/tdash-design-system.yml', '.github/workflows/uptime-status.yml'],
      dir
    );
    assert.equal(docs.status, 0, docs.stderr);
    assert.match(docs.output, /^relevant=false$/m);
    assert.match(docs.stdout, /skipped: no relevant changes/);

    fs.writeFileSync(path.join(dir, 'tdash/app.js'), 'changed\n');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-qm', 'tdash']);
    const tdashHead = git(dir, ['rev-parse', 'HEAD']);
    const relevant = run(
      { GITHUB_EVENT_NAME: 'pull_request', BASE_SHA: base, HEAD_SHA: tdashHead },
      ['tdash', '.github/workflows/tdash-design-system.yml'],
      dir
    );
    assert.equal(relevant.status, 0, relevant.stderr);
    assert.match(relevant.output, /^relevant=true$/m);
    assert.match(relevant.stdout, /tdash\/app\.js/);

    git(dir, ['reset', '--hard', '-q', docsHead]);
    fs.writeFileSync(
      path.join(dir, '.github/workflows/tdash-design-system.yml'),
      'workflow changed\n'
    );
    git(dir, ['add', '.']);
    git(dir, ['commit', '-qm', 'workflow']);
    const workflowHead = git(dir, ['rev-parse', 'HEAD']);
    const workflow = run(
      { GITHUB_EVENT_NAME: 'pull_request', BASE_SHA: base, HEAD_SHA: workflowHead },
      ['tdash', '.github/workflows/tdash-design-system.yml'],
      dir
    );
    assert.equal(workflow.status, 0, workflow.stderr);
    assert.match(workflow.output, /^relevant=true$/m);
    assert.match(workflow.stdout, /tdash-design-system\.yml/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function pullRequestBlock(source) {
  const on = source.split(/^on:\n/m)[1]?.split(/^jobs:\n/m)[0] || '';
  const match = on.match(/^  pull_request:\n([\s\S]*?)(?=^  [a-z]|\n*$)/m);
  return match ? match[1] : '';
}

test('required workflows drop pull_request path filters and keep push filters', () => {
  assert.doesNotMatch(pullRequestBlock(market), /paths:/);
  assert.doesNotMatch(pullRequestBlock(tdash), /paths:/);
  assert.match(
    market,
    /push:\n    branches:\n      - main\n      - master\n    paths:\n      - '\.github\/workflows\/market-readiness-local\.yml'/
  );
  assert.match(
    tdash,
    /push:\n    branches:\n      - main\n      - master\n    paths:\n      - 'tdash\/\*\*'/
  );
  assert.match(market, /^permissions:\n  contents: read$/m);
  assert.match(tdash, /^permissions:\n  contents: read$/m);
  assert.match(market, /^  local-gates:\n/m);
  assert.match(market, /^  configured-image-restore:\n/m);
  assert.match(tdash, /^  guard-and-build:\n/m);
  assert.match(market, /echo "skipped: no relevant changes"/);
  assert.match(tdash, /echo "skipped: no relevant changes"/);
  assert.match(market, /if: steps\.changes\.outputs\.relevant == 'true'/);
  assert.match(tdash, /if: steps\.changes\.outputs\.relevant == 'true'/);
  assert.match(market, /id: changes/);
  assert.match(tdash, /id: changes/);
  for (const pathspec of [
    "'.github/dependabot.yml'",
    "'.github/workflows/dependency-audit-scheduled.yml'",
    "'.github/workflows/market-readiness-local.yml'",
    "'.github/workflows/uptime-status.yml'",
    "'package.json'",
    "'scripts'",
    "'tdash'",
    "'tixmoapi2'",
  ]) {
    assert.match(market, new RegExp(pathspec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const pathspec of [
    "'tdash'",
    "'.github/workflows/tdash-design-system.yml'",
    "'.github/workflows/uptime-status.yml'",
  ]) {
    assert.match(tdash, new RegExp(pathspec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('http-soak stays opt-in on its own branch and path filter', () => {
  assert.match(soak, /pull_request:\n    paths:/);
  assert.match(soak, /if: github\.head_ref == 'codex\/http-soak-qualification'/);
  assert.doesNotMatch(soak, /ci-relevant-changes/);
});
