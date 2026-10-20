const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

class OperatorError extends Error {}
let prisma;

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift() || 'list';
  if (command === '--help') {
    console.log(
      'Usage: node prisma/reconcile-approval-reminders.js list | resolve --id ID --outcome sent|not-sent --reason "provider evidence" [--provider-message-id ID]'
    );
    console.log(
      'Requires explicit TIXMO_REMINDER_DATABASE_URL matching DATABASE_URL if present. Resolve also requires TIXMO_ALLOW_REMINDER_RECONCILIATION=true. Confirm the provider outcome before resolving an UNCERTAIN record.'
    );
    return;
  }
  if (!['list', 'resolve'].includes(command))
    throw new OperatorError('Unknown reminder reconciliation command.');
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (
      !['--id', '--outcome', '--reason', '--provider-message-id'].includes(key) ||
      !args[index + 1] ||
      options[key]
    )
      throw new OperatorError('Invalid or duplicate reminder reconciliation option.');
    options[key] = args[index + 1];
  }
  if (command === 'list' && args.length)
    throw new OperatorError('List does not accept mutation options.');
  if (command === 'resolve') {
    if (process.env.TIXMO_ALLOW_REMINDER_RECONCILIATION !== 'true')
      throw new OperatorError('Resolve requires TIXMO_ALLOW_REMINDER_RECONCILIATION=true.');
    if (
      !options['--id'] ||
      !['sent', 'not-sent'].includes(options['--outcome']) ||
      !options['--reason'] ||
      options['--reason'].length < 10 ||
      options['--reason'].length > 500
    )
      throw new OperatorError(
        'Resolve requires an ID, confirmed outcome and a 10-500 character provider-evidence reason.'
      );
    if (
      options['--outcome'] === 'sent' &&
      (!options['--provider-message-id'] || options['--provider-message-id'].length > 512)
    )
      throw new OperatorError('A confirmed send requires its provider message ID.');
  }
  const explicit = process.env.TIXMO_REMINDER_DATABASE_URL;
  let target;
  try {
    target = new URL(explicit || '');
  } catch {
    throw new OperatorError('An explicit TIXMO_REMINDER_DATABASE_URL is required.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    (process.env.DATABASE_URL && process.env.DATABASE_URL !== explicit)
  )
    throw new OperatorError(
      'The explicit reminder target must be PostgreSQL and match the inherited DATABASE_URL if present.'
    );
  prisma = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  if (command === 'list') {
    const rows = await prisma.approvalReminder.findMany({
      where: { status: 'UNCERTAIN' },
      take: 100,
      orderBy: { claimedAt: 'asc' },
      select: { id: true, status: true, claimedAt: true, attempts: true, providerMessageId: true },
    });
    console.log(JSON.stringify({ reminders: rows, limitedTo: 100 }, null, 2));
    return;
  }
  const sent = options['--outcome'] === 'sent';
  const result = await prisma.approvalReminder.updateMany({
    where: { id: options['--id'], status: 'UNCERTAIN' },
    data: {
      status: sent ? 'SENT' : 'FAILED',
      sentAt: sent ? new Date() : null,
      providerMessageId: sent ? options['--provider-message-id'] : null,
      leaseToken: null,
      claimedAt: null,
      nextAttemptAt: sent ? null : new Date(),
      ...(sent ? {} : { attempts: 0 }),
      lastError: `Operator reconciliation: ${options['--reason']}`,
    },
  });
  if (result.count !== 1)
    throw new OperatorError('The reminder is no longer UNCERTAIN; no reconciliation was applied.');
  console.log(
    JSON.stringify({ id: options['--id'], status: sent ? 'SENT' : 'FAILED', reconciled: true })
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof OperatorError
        ? error.message
        : 'Reminder reconciliation failed. Check the explicit target and database state.'
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
