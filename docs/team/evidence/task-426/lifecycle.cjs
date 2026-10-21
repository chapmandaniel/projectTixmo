'use strict';
const { cleanupSteps } = require('./cleanup.cjs');
function tracker() {
  const pending = new Set();
  return {
    run(work) {
      const promise = Promise.resolve().then(work);
      pending.add(promise);
      promise.then(() => pending.delete(promise), () => pending.delete(promise));
      return promise;
    },
    get size() { return pending.size; },
    async join(timeoutMs = 3000) {
      const deadline = Date.now() + timeoutMs;
      while (pending.size) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error('Mutable work still pending: ' + pending.size);
        let timer;
        try { await Promise.race([Promise.allSettled([...pending]), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Mutable work join deadline: ' + pending.size)), remaining); })]); }
        finally { clearTimeout(timer); }
      }
    },
  };
}
async function finalize({ primary, steps, receipt, publish, report = console.error }) {
  const cleanup = await cleanupSteps(steps);
  const result = { ...receipt(), status: primary ? 'FAILED' : cleanup.some(x => !x.ok) ? 'CLEANUP_FAILED' : 'PASSED', originalFailure: primary ? String(primary.stack || primary) : null, cleanup };
  let artifactError;
  try { publish(result); } catch (error) { artifactError = error; report('Task426 artifact publication failed: ' + String(error) + '; originalFailure=' + result.originalFailure + '; cleanup=' + JSON.stringify(cleanup)); }
  if (primary) throw primary;
  if (cleanup.some(x => !x.ok)) throw new Error('Owned cleanup incomplete: ' + JSON.stringify(cleanup));
  if (artifactError) throw artifactError;
}
module.exports = { tracker, finalize };
