'use strict';
// First Node entry after env -i; builtins/helpers only, never loads Jest/app.
try {
  if (process.env.TASK426_PM_RUNTIME_GRANT !== 'source-reviewed-sole-owner') throw new Error('Missing explicit task426 grant (string alone is not authorization)');
  if (process.env.TASK426_REJECT_PRELOAD !== '0') throw new Error('Ambient preload rejected before Node entry');
  require('./preflight.cjs').verify();
  // Do not make unresolved safety requirements optional via flags/receipts.
  throw new Error('Runtime admission CLOSED: escaped-tree containment/reaping, immutable dependencies, observer/service identities and bounded teardown unresolved; zero qualification children/provisioning');
} catch (error) {
  console.error('TASK426_PREJEST_DENIED: ' + error.message);
  process.exitCode = 2;
}
