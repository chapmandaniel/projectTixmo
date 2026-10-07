'use strict';
// Compatibility no-op for older deployment overrides that still invoke db:seed.
// Account provisioning is an explicit, guarded one-time operation.
console.log('Automatic account seeding is disabled; use the guarded db:bootstrap command');
