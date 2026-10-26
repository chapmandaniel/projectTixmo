'use strict';

class BrowserDeadline extends Error {}

// A stalled event loop makes a short timer overdue before the socket is read.
// Node runs timers before I/O, so Promise.race would report a deadline even
// when the CDP response is already buffered. Yield once, after the timer, so
// that buffered response can settle first. A command that is still pending
// after that turn is a real deadline.
function deadline(promise, ms) {
  let timer;
  let settled = false;
  const work = Promise.resolve(promise).then(
    (value) => {
      settled = true;
      return value;
    },
    (error) => {
      settled = true;
      throw error;
    },
  );
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      setImmediate(() => {
        if (settled) resolve(undefined);
        else reject(new BrowserDeadline());
      });
    }, ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { BrowserDeadline, deadline };
