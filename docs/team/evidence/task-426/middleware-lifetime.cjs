'use strict';
// For installed promise-returning middleware ONLY. A response/socket close is
// not this lifetime: async store waits may still invoke next() after close.
function promiseMiddleware(original, work) {
  return function (...args) {
    return work.run(() => {
      const result = original.apply(this, args);
      if (!result || typeof result.then !== 'function') throw new Error('Expected promise-returning middleware; cannot establish continuation lifetime');
      return result;
    });
  };
}
module.exports = { promiseMiddleware };
