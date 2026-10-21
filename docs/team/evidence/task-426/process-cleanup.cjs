 'use strict';
// Adapt task393 observation into an owned qualification lifecycle. Linux only.
// Never accept a PID receipt as signalling authority. Authority is a live child handle.
const fs = require('node:fs');
const {spawn} = require('node:child_process');
const owned = new WeakSet();
function errorRecord(error) {
  return Object.fromEntries(['name','message','stack','code','errno','syscall','path','spawnargs'].map(key => [key, error[key] ?? null]));
}
// A callback may reject any JavaScript value. Read/convert defensively so
// secondary diagnostics cannot replace the primary child result.
function callbackFailure(value) {
  const read = key => { try { return value == null ? undefined : value[key]; } catch { return undefined; } };
  const stringify = item => { try { return String(item); } catch { return '<unprintable rejection>'; } };
  const message = read('message');
  const error = new Error(typeof message === 'string' ? message : `Callback rejected (${typeof value}): ${stringify(value)}`);
  const stack = read('stack'), code = read('code');
  if (typeof stack === 'string' && stack) error.stack = stack;
  if (typeof code === 'string' || typeof code === 'number') error.code = code;
  return error;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function stat(pid) {
  const text = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
  const fields = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/);
  return {pid, state:fields[0], ppid:Number(fields[1]), group:Number(fields[2]), session:Number(fields[3]), start:fields[19], uid:fs.statSync(`/proc/${pid}`).uid};
}
function members(group) {
  return fs.readdirSync('/proc').filter(x => /^\d+$/.test(x)).flatMap(x => {
    try { const s = stat(Number(x)); return s.group === group ? [s] : []; }
    catch(error) { if (['ENOENT','ESRCH'].includes(error.code)) return []; throw error; }
  });
}
function launch(command, args, options) {
  // stdio inherited: original stderr remains observable even if disk receipts fail.
  const child = spawn(command, args, {...options, detached:true, stdio:'inherit'});
  const record = {child, identity:null, result:null};
  owned.add(record);
  record.closed = new Promise(resolve => {
    child.once('error', error => {record.result = {error:errorRecord(error)}; resolve(record.result);});
    child.once('close', (code, signal) => {record.result = {...record.result, code, signal}; resolve(record.result);});
  });
  if (child.pid) record.identity = stat(child.pid);
  return record;
}
// Bounds asynchronous waiting only. A callback can continue after timeout; this
// is not cancellation, synchronous-code preemption, or service teardown proof.
async function boundedCallback(callback, ms, label) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(callback),
      new Promise((_, reject) => { timer = setTimeout(() => {
        const error = new Error(`${label} callback deadline exceeded; pending callback may have late effects`);
        error.code = 'CALLBACK_DEADLINE'; reject(error);
      }, ms); }),
    ]);
  } finally { clearTimeout(timer); }
  // Timer intentionally referenced: an unsettled callback alone cannot keep
  // Node alive long enough to deliver its deadline and receipt.
}
async function finish(record, {timeoutMs=1000, graceMs=1000, teardownMs=1000, evidenceMs=1000, teardown, writeEvidence=()=>{}}={}) {
  if (!owned.has(record)) throw new Error('No live owned child authority');
  for (const [name, value] of Object.entries({timeoutMs, graceMs, teardownMs, evidenceMs})) {
    if (!Number.isInteger(value) || value < 1 || value > 60000) throw new RangeError(`${name} must be an integer in 1..60000 milliseconds`);
  }
  if ((teardown !== undefined && typeof teardown !== 'function') || typeof writeEvidence !== 'function') throw new TypeError('Cleanup callbacks must be functions');
  // Consume synchronously before any await or callback: one completion owner,
  // including concurrent calls and teardown/evidence callback reentrancy.
  owned.delete(record);
  let timedOut = false, failure, teardownStatus = 'not-started';
  const deadline = Date.now() + timeoutMs;
  while (!record.result && Date.now() < deadline) await delay(10);
  if (!record.result) timedOut = true;
  const id = record.identity;
  function signal(value) {
    if (!id) return;
    const rows = members(id.group);
    if (!rows.length) return;
    // Descendants must remain in this owned session. Refuse changed authority.
    if (id.group !== record.child.pid || id.session !== record.child.pid || rows.some(s => s.uid !== process.getuid() || s.session !== id.session)) throw new Error('Owned session identity mismatch');
    const root = rows.find(s => s.pid === id.pid);
    if (root && root.start !== id.start) throw new Error('Owned PID recycled');
    process.kill(-id.group, value);
  }
  try {
    if (id && members(id.group).length) {
      signal('SIGTERM');
      const end = Date.now() + graceMs;
      while (members(id.group).length && Date.now() < end) await delay(10);
      if (members(id.group).length) signal('SIGKILL');
    }
    const end = Date.now() + graceMs;
    while ((!record.result || (id && members(id.group).length)) && Date.now() < end) await delay(10);
    if (!record.result || (id && members(id.group).length)) throw new Error('Process tree disappearance/reaping unproven; services MUST remain running');
    await record.closed; // direct child reaped by Node before service teardown
    if (teardown) {
      teardownStatus = 'pending';
      try {
        await boundedCallback(teardown, teardownMs, 'Teardown');
        teardownStatus = 'completed';
      } catch(error) {
        error = callbackFailure(error);
        teardownStatus = error.code === 'CALLBACK_DEADLINE' ? 'timed-out-pending-late-effects-possible' : 'failed';
        throw error;
      }
    }
  } catch(error) { failure = callbackFailure(error); }
  const report = {timedOut, result:record.result, teardownStatus, cleanupError:failure?.stack, evidenceStatus:'pending'};
  try {
    await boundedCallback(() => writeEvidence(report), evidenceMs, 'Evidence');
    report.evidenceStatus = 'completed';
  } catch(error) {
    error = callbackFailure(error);
    report.evidenceStatus = error.code === 'CALLBACK_DEADLINE' ? 'timed-out-pending-late-effects-possible' : 'failed';
    report.evidenceError = error.stack; console.error(error.stack);
  }
  if (failure) throw Object.assign(failure, {report});
  return report;
}
module.exports = {launch, finish};
