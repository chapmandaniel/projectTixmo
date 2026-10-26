'use strict';

// One named task, then exit. This process never loads the HTTP server.
const { PrismaClient } = require('@prisma/client');
const {
  explicitTarget,
  systemDryRun,
  systemApply,
  OperatorError,
} = require('../prisma/reconcile-ticket-inventory.js');

const TASKS = Object.freeze({
  'inventory-reconcile-dry-run': { mode: 'dry-run' },
  'inventory-reconcile-apply': { mode: 'apply' },
});

function inventoryEnv(env) {
  if (env.TIXMO_INVENTORY_DATABASE_URL) return env;
  if (!env.DATABASE_URL) {
    throw new OperatorError('DATABASE_URL is required when TIXMO_INVENTORY_DATABASE_URL is unset.');
  }
  return { ...env, TIXMO_INVENTORY_DATABASE_URL: env.DATABASE_URL };
}

function line(task, ok, extra) {
  console.log(JSON.stringify({ task, ok, ...extra }));
}

async function run(name, env) {
  const spec = TASKS[name];
  if (!spec) {
    throw new OperatorError(
      'Unknown task. Expected inventory-reconcile-dry-run or inventory-reconcile-apply.'
    );
  }
  const taskEnv = inventoryEnv(env);
  if (
    spec.mode === 'apply' &&
    (taskEnv.TIXMO_ALLOW_INVENTORY_RECONCILIATION !== 'true' ||
      taskEnv.TIXMO_INVENTORY_WRITERS_QUIESCED !== 'true')
  ) {
    throw new OperatorError(
      'Apply requires TIXMO_ALLOW_INVENTORY_RECONCILIATION=true and TIXMO_INVENTORY_WRITERS_QUIESCED=true.'
    );
  }
  const target = explicitTarget(taskEnv);
  const prisma = new PrismaClient({ datasources: { db: { url: target.url } } });
  try {
    const result =
      spec.mode === 'dry-run'
        ? await systemDryRun(prisma, { upcomingOnly: true, resolveUnknown: true })
        : await systemApply(prisma, {
            upcomingOnly: true,
            resolveUnknown: true,
            env: taskEnv,
          });
    console.log(JSON.stringify(result, null, 2));
    line(name, true, { changed: result.changed, writes: result.writes });
  } finally {
    await prisma.$disconnect();
  }
}

async function main(argv = process.argv, env = process.env) {
  const name = argv[2] || '';
  if (argv.length !== 3) {
    console.log('Usage: npm run task -- <name>');
    line(name, false, { error: 'Usage: npm run task -- <name>' });
    return 1;
  }
  try {
    await run(name, env);
    return 0;
  } catch (error) {
    const message = error instanceof OperatorError ? error.message : 'Task failed.';
    console.log(message);
    line(name, false, { error: message });
    return 1;
  }
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}

module.exports = { TASKS, inventoryEnv, run, main };
