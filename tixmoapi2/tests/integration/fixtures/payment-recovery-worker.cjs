// Test-owned subprocess: real compiled PaymentService/Prisma; synthetic transport only.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../../../..');
require(path.join(root, 'scripts/verification-safety.cjs')).validateVerificationTargets(
  process.env
);
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.STRIPE_SECRET_KEY, 'sk_test_task566_synthetic');
const spec = JSON.parse(process.argv[2]);
const compiled = path.join(root, 'tixmoapi2/dist/api/payments/service.js');
assert(fs.existsSync(compiled), 'Build API before recovery integration tests; dist is missing');
assert(
  fs.statSync(compiled).mtimeMs >=
    fs.statSync(path.join(root, 'tixmoapi2/src/api/payments/service.ts')).mtimeMs,
  'Build API before recovery integration tests; dist predates PaymentService source'
);
const calls = [];
const ledger = () => JSON.parse(fs.readFileSync(spec.ledger, 'utf8'));
const writeLedger = (value) => {
  const fd = fs.openSync(spec.ledger, 'w', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(value));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  const dir = fs.openSync(path.dirname(spec.ledger), 'r');
  try {
    fs.fsyncSync(dir);
  } finally {
    fs.closeSync(dir);
  }
};
const provider = {
  paymentIntents: {
    retrieve: async (id) => {
      calls.push(['intent', id]);
      if (spec.poisonIntents.includes(id)) throw new Error('Synthetic unavailable transport');
      return { id, status: 'succeeded', amount_received: 1000, currency: 'usd' };
    },
  },
  refunds: {
    list: async (args) => {
      calls.push(['list', args.payment_intent]);
      if (spec.unavailableIntents.includes(args.payment_intent))
        throw new Error('Synthetic ledger unavailable');
      return {
        data: ledger()
          .effects.map((effect) => effect.response)
          .filter((effect) => effect.payment_intent === args.payment_intent),
      };
    },
    retrieve: async () => {
      throw new Error('Unexpected provider refund retrieve');
    },
    create: async (args, options) => {
      calls.push(['create', args.payment_intent]);
      const value = ledger();
      assert(
        !value.effects.some((effect) => effect.key === options.idempotencyKey),
        'Duplicate synthetic provider effect'
      );
      const response = {
        id: 're_' + args.metadata.refundId,
        status: 'succeeded',
        amount: args.amount,
        currency: 'usd',
        payment_intent: args.payment_intent,
        metadata: args.metadata,
      };
      value.effects.push({ key: options.idempotencyKey, response });
      writeLedger(value);
      if (spec.pauseAfterEffect) {
        process.send({ type: 'effect-before-return', pid: process.pid, calls });
        await new Promise(() => {}); // Parent kills/reaps this exact owned process.
      }
      return response;
    },
  },
  events: {
    retrieve: async (id) => {
      calls.push(['event', id]);
      if (spec.poisonEvents.includes(id)) throw new Error('Synthetic event unavailable');
      return { id, type: 'task566.synthetic.unsupported', data: { object: {} } };
    },
  },
};
const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'stripe')
    return class {
      constructor() {
        return provider;
      }
    };
  if (request.endsWith('/notificationService'))
    return {
      notificationService: new Proxy(
        {},
        {
          get() {
            throw new Error('Notification transport forbidden');
          },
        }
      ),
    };
  if (request.endsWith('/logger'))
    return { logger: { error() {}, warn() {}, info() {}, debug() {} } };
  return original.call(this, request, parent, isMain);
};
(async () => {
  const db = require(path.join(root, 'tixmoapi2/dist/config/prisma.js')).default;
  // Scope actual SQL selections to owned fixtures; retain service predicates,
  // ordering, take=50 and CAS. No reconciliation/finalizer/Prisma result mocks.
  for (const [model, ownership] of [
    ['paymentWebhookEvent', { id: { in: spec.eventIds } }],
    ['paymentRefund', { orderId: { in: spec.orderIds } }],
    ['order', { id: { in: spec.orderIds } }],
    ['paymentAttempt', { orderId: { in: spec.orderIds } }],
  ]) {
    const find = db[model].findMany.bind(db[model]);
    db[model].findMany = (args) => find({ ...args, where: { AND: [args.where, ownership] } });
  }
  try {
    const { PaymentService } = require(compiled);
    const service = new PaymentService();
    if (spec.mode === 'webhook') await service.recoverPayments();
    else await service.recoverRefunds();
    await db.$disconnect();
    process.send({ type: 'complete', pid: process.pid, calls });
    process.disconnect();
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
})().catch(() => {
  process.stderr.write('Recovery worker failed (details suppressed)\n');
  process.exitCode = 1;
  if (process.connected) process.disconnect();
});
