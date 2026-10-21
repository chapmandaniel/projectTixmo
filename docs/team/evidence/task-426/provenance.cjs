'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function verify(filename, env) {
  const source = fs.realpathSync(filename);
  const root = fs.realpathSync(path.resolve(path.dirname(source), '../../..'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  if (fs.realpathSync(git(['rev-parse', '--show-toplevel'])) !== root) throw new Error('Executed source root mismatch');
  const sourceSHA = git(['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40}$/.test(env.TASK426_EXPECTED_SHA || '') || sourceSHA !== env.TASK426_EXPECTED_SHA) throw new Error('Require exact executed TASK426_EXPECTED_SHA');
  git(['diff', '--no-ext-diff', '--quiet', 'HEAD', '--']);
  const relative = path.relative(root, source);
  const blob = execFileSync('git', ['show', 'HEAD:' + relative], {cwd: root});
  if (!fs.readFileSync(source).equals(blob)) throw new Error('Executed source differs from HEAD');
  if (git(['ls-files', '--others', '--exclude-standard', '--', 'tixmoapi2/src', 'tixmoapi2/tests', 'docs/team/evidence/task-426'])) throw new Error('Untracked executable source');
  if (!env.TASK426_DEPENDENCY_ROOT) throw new Error('Require matched TASK426_DEPENDENCY_ROOT');
  const dependencyRoot = fs.realpathSync(env.TASK426_DEPENDENCY_ROOT);
  const api = path.join(root, 'tixmoapi2');
  const manifest = {};
  for (const file of ['package.json', 'package-lock.json', 'prisma/schema.prisma']) {
    const bytes = fs.readFileSync(path.join(api, file));
    if (!bytes.equals(fs.readFileSync(path.join(dependencyRoot, file)))) throw new Error('Dependency identity mismatch: ' + file);
    manifest[file] = hash(bytes);
  }
  const requireSource = createRequire(source);
  const modules = fs.realpathSync(path.join(dependencyRoot, 'node_modules'));
  if (fs.realpathSync(path.join(api, 'node_modules')) !== modules) throw new Error('Executed dependency root mismatch');
  const dependencies = JSON.parse(fs.readFileSync(path.join(api, 'package.json')));
  const resolved = {};
  for (const name of Object.keys({...dependencies.dependencies, ...dependencies.devDependencies})) {
    const directory = fs.realpathSync(path.join(api, 'node_modules', name));
    if (!directory.startsWith(modules + path.sep)) throw new Error('Dependency resolves outside matched root: ' + name);
    const packageDigest = hash(fs.readFileSync(path.join(directory, 'package.json')));
    resolved[name] = {directory, packageDigest};
    if (dependencies.dependencies?.[name]) {
      const entry = fs.realpathSync(requireSource.resolve(name));
      if (!entry.startsWith(modules + path.sep)) throw new Error('Dependency entry resolves outside matched root: ' + name);
      resolved[name].entry = entry;
      resolved[name].entryDigest = hash(fs.readFileSync(entry));
    }
  }
  const installedLockDigest = hash(fs.readFileSync(path.join(modules, '.package-lock.json')));
  return { sourceRoot: root, sourceSHA, sourceDigest: hash(blob), dependencyRoot, manifest, installedLockDigest, resolved };
}
module.exports = { verify };
