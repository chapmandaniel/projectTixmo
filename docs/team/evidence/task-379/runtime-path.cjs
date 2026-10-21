'use strict';
// Synchronous fail-closed preflight; no services, sockets or credential reads.
const fs = require('node:fs');
const path = require('node:path');
const root = '/home/daniel/.openclaw/workspace/tixmo-pm/runtime/task-379';
function validate(target, prepare = false) {
  if (!(prepare && target === root) && (path.dirname(target) !== root || !/^run\.[A-Za-z0-9]+$/.test(path.basename(target)))) throw new Error('Invalid runtime location');
  let current = '/';
  for (const part of target.split('/').filter(Boolean)) {
    current = path.join(current, part);
    if (prepare && !fs.existsSync(current) && (current === root || current === path.dirname(root))) fs.mkdirSync(current, { mode: 0o700 });
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || ![0, process.getuid()].includes(stat.uid) || (stat.mode & 0o022)) throw new Error('Unsafe runtime ancestor: ' + current);
    if (current === path.dirname(root) || current === root || current === target) {
      if (stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700) throw new Error('Require owned 0700 runtime: ' + current);
    }
  }
  if (fs.realpathSync(target) !== target) throw new Error('Runtime realpath mismatch');
  // Explicit disk filesystem allowlist: ext, XFS, Btrfs, ZFS. Reject tmpfs/ramfs/unknown.
  if (![0xef53, 0x58465342, 0x9123683e, 0x2fc12fc1].includes(fs.statfsSync(target).type)) throw new Error('Runtime backing is not verified disk filesystem');
  return target;
}
module.exports = { validate };
if (require.main === module) validate(process.argv[2], process.argv[3] === '--prepare');
