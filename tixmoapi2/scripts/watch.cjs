const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function watch({ directory = process.cwd(), command = process.execPath, args = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'src/index.ts'], debounceMs = 120 } = {}) {
  let child;
  let timer;
  let restarting = false;
  let pending = false;
  let closing = false;
  let closePromise;
  const source = path.join(directory, 'src');
  const directories = new Set();
  const refreshDirectories = () => {
    directories.clear();
    const visit = (parent) => {
      let entries;
      try {
        entries = fs.readdirSync(parent, { withFileTypes: true });
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return;
        throw error;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const nested = path.join(parent, entry.name);
        directories.add(path.relative(source, nested));
        visit(nested);
      }
    };
    visit(source);
  };
  refreshDirectories();
  const stop = async () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const previous = child;
    await new Promise((resolve) => {
      previous.once('close', resolve);
      previous.kill('SIGTERM');
      const force = setTimeout(() => previous.kill('SIGKILL'), 5000);
      force.unref();
      previous.once('close', () => clearTimeout(force));
    });
  };
  const restart = async () => {
    pending = true;
    if (restarting || closing) return;
    restarting = true;
    try {
      while (pending && !closing) {
        pending = false;
        await stop();
        if (closing) break;
        child = spawn(command, args, { cwd: directory, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development', TS_NODE_TRANSPILE_ONLY: 'true' } });
        child.on('error', (error) => console.error('Development process failed:', error.message));
      }
    } finally {
      restarting = false;
    }
  };
  let watcher;
  const onWatchError = (error) => {
    console.error('Development watcher failed:', error.message);
    process.exitCode = 1;
    void close();
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void restart(), debounceMs);
  };
  const onChange = (event, filename) => {
    const name = filename?.toString();
    if (closing) return;
    let directoryChange = false;
    if (name && event === 'rename') {
      directoryChange = directories.has(name);
      try {
        directoryChange ||= fs.statSync(path.join(source, name)).isDirectory();
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
          onWatchError(error);
          return;
        }
      }
      if (directoryChange) {
        try {
          refreshDirectories();
        } catch (error) {
          onWatchError(error);
          return;
        }
      }
    }
    if (name && !directoryChange && (!/\.(ts|json)$/.test(name) || /\.test\.ts$/.test(name))) return;
    schedule();
  };
  const bindSource = () => {
    watcher?.close();
    watcher = undefined;
    try {
      watcher = fs.watch(source, { recursive: true }, onChange);
      watcher.on('error', onWatchError);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    }
    refreshDirectories();
  };
  // Watching the parent keeps root deletion/rename and recreation observable;
  // the recursive watcher otherwise remains attached to the old directory.
  const parentWatcher = fs.watch(directory, (event, filename) => {
    if (closing || event !== 'rename' || (filename && filename.toString() !== path.basename(source))) return;
    try {
      bindSource();
      schedule();
    } catch (error) {
      onWatchError(error);
    }
  });
  parentWatcher.on('error', onWatchError);
  bindSource();
  const close = () => {
    if (closePromise) return closePromise;
    closing = true;
    pending = false;
    clearTimeout(timer);
    watcher?.close();
    parentWatcher.close();
    closePromise = stop();
    return closePromise;
  };
  void restart();
  return { close };
}

module.exports = { watch };
if (require.main === module) {
  const supervisor = watch();
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => void supervisor.close());
}
