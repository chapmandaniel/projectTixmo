'use strict';
const signals = require('node:os').constants.signals;
// Shell convention: preserve nonzero primary status despite secondary failures.
// Report retains original code/signal/error; mapping never replaces diagnostics.
function status(report) {
  const result = report?.result;
  if (result?.error) return result.error.code === 'ENOENT' ? 127 : 126;
  if (result?.signal && signals[result.signal]) return 128 + signals[result.signal];
  if (Number.isInteger(result?.code) && result.code > 0 && result.code <= 255) return result.code;
  if (report?.timedOut) return 124;
  if (!result || result.code !== 0 || report.cleanupError || report.evidenceError) return 1;
  return 0;
}
module.exports = {status};
