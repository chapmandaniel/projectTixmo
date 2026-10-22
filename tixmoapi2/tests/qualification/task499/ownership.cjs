'use strict';
// SOURCE-ONLY task499 seam, not a runner or an executable HTTP qualification.
// tracker mutable-set algorithm: task426 exact510824df9e9bb7f5e57984862728b52929f7f849.
// Permanent preservation + before-write ID inventory: task493 exact5526991b45eb8cf93eeda23205f8341b5637ae90.
// No finalize/cleanupSteps copied: uncertainty must stop ALL following teardown.
function checkoutOwnership(ids, timeoutMs = 3000) {
  const pending = new Set();
  const inventory = Object.freeze(structuredClone(ids));
  let failure, stopped = false;
  function admit() {
    if (failure) throw failure;
    if (stopped) throw new Error('Last-ten fixture admission stopped');
  }
  function preserve(error) {
    if (!failure) failure = new Error('STOP last-ten; preserve fixture IDs: ' + JSON.stringify(inventory), { cause: error });
    throw failure;
  }
  // Track actual raw work, not a timeout/client wrapper. Internal continuations
  // may register during drainage; do not close this registration prematurely.
  function run(operation) {
    if (failure) return Promise.reject(failure);
    const promise = Promise.resolve().then(operation);
    pending.add(promise);
    promise.then(() => pending.delete(promise), () => pending.delete(promise));
    return promise;
  }
  async function join() {
    if (failure) throw failure;
    const deadline = Date.now() + timeoutMs;
    while (pending.size) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) preserve(new Error('Raw work pending: ' + pending.size));
      let timer;
      try {
        await Promise.race([Promise.allSettled([...pending]), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Raw work join deadline: ' + pending.size)), remaining);
        })]);
      } catch (error) { preserve(error); }
      finally { clearTimeout(timer); }
    }
    if (failure) throw failure;
  }
  // Acquisition/setup/snapshot/observer/cancel/close/disconnect failures are
  // conservative uncertainty. A settled HTTP error is instead inspected by its
  // caller after run(), then joined before any teardown decision.
  async function critical(operation) {
    if (failure) throw failure;
    const result = run(operation);
    try { await join(); return await result; }
    catch (error) { preserve(error); }
  }
  async function teardown(steps) {
    stopped = true;
    await join();
    for (const step of steps) await critical(step);
  }
  return { run, join, critical, teardown, admit, stop() { stopped = true; },
    get size() { return pending.size; }, get preserved() { return Boolean(failure); },
    get inventory() { return structuredClone(inventory); } };
}
// Same promise-returning-middleware contract as task426 exact510824df; tracks
// the continuation encompassing store wait AND next(), not only Redis command.
function promiseMiddleware(original, work) {
  return function (...args) {
    return work.run(() => {
      const result = original.apply(this, args);
      if (!result || typeof result.then !== 'function') throw new Error('Expected promise-returning middleware; cannot establish continuation lifetime');
      return result;
    });
  };
}
// Allocate all setup IDs before the first write. Orders/tickets are generated
// by the mounted API; their ownership must be recovered via these event/user
// scopes even if a client never receives its response. Never global-delete.
function preallocateCheckout(uuid) {
  return { organization: uuid(), event: uuid(), ticketType: uuid(),
    buyers: Array.from({ length: 100 }, () => uuid()),
    foreign: { organization: uuid(), event: uuid(), ticketType: uuid(), buyer: uuid() } };
}
module.exports = { checkoutOwnership, promiseMiddleware, preallocateCheckout };
