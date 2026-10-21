 'use strict';
// Adapt task393 observation into an owned qualification lifecycle. Linux only.
// Never accept a PID receipt as signalling authority. Authority is a live child handle.
const fs = require('node:fs');
const {spawn} = require('node:child_process');
const owned = new WeakSet();
function errorRecord(error) {
  return Object.fromEntries(['name','message','stack','code','errno','syscall','path','spawnargs'].map(key => [key, error[key] ?? null]));
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
async function finish(record, {timeoutMs=1000, graceMs=1000, teardown, writeEvidence=()=>{}}={}) {
  if (!owned.has(record)) throw new Error('No live owned child authority');
  let timedOut = false, failure;
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
    if (teardown) await teardown();
  } catch(error) { failure = error; }
  const report = {timedOut, result:record.result, cleanupError:failure?.stack};
  try { await writeEvidence(report); } catch(error) { report.evidenceError = error.stack; console.error(error.stack); }
  owned.delete(record);
  if (failure) throw Object.assign(failure, {report});
  return report;
}
module.exports = {launch, finish};
