'use strict';
// CI-only fixture worker, executed inside each actual production image.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { guard } = require('/task606-driver.cjs');
let phase = 'guard';
let providerAttempts = 0;
let server, prisma, redis;
let safe = true;
const stateFile = '/task606-state/owned.json';
const save = (value) => fs.writeFileSync(stateFile, JSON.stringify(value), { mode: 0o600 });
const bounded = async (work, ms = 10000) => {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          safe = false;
          reject(Error('Deadline'));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
function forbidTransport() {
  for (const module of ['node:http', 'node:https']) {
    const api = require(module);
    for (const method of ['request', 'get'])
      api[method] = () => {
        providerAttempts++;
        throw Error('Transport refused');
      };
  }
}
async function main() {
  guard(process.env);
  if (!['new', 'old', 'forward', 'cleanup'].includes(process.env.TIXMO_ROLLBACK_PHASE))
    throw Error('Phase');
  const mode = process.env.TIXMO_ROLLBACK_PHASE;
  // Native fetch is retained solely for our own mounted loopback server below.
  const localFetch = global.fetch;
  global.fetch = async () => {
    providerAttempts++;
    throw Error('Transport refused');
  };
  forbidTransport();
  const database = new URL(process.env.DATABASE_URL);
  database.searchParams.set('connection_limit', '1');
  database.searchParams.set('pool_timeout', '5');
  process.env.DATABASE_URL = database.href;
  prisma = require('/app/dist/config/prisma').default;
  redis = require('/app/dist/config/redis');
  phase = 'connect';
  await bounded(prisma.$connect());
  await prisma.$executeRawUnsafe("SET statement_timeout='5000'");
  await prisma.$executeRawUnsafe("SET lock_timeout='2000'");
  await bounded(redis.connectRedis());
  const [version] = await prisma.$queryRawUnsafe(
    "SELECT current_setting('server_version_num') AS version"
  );
  assert.ok(Number(version.version) >= 180000 && Number(version.version) < 190000);
  assert.match(
    await redis.getRedisClient().info('server'),
    /(?:^|\r?\n)redis_version:8\.2\.9(?:\r?\n|$)/
  );
  const ledger = async () =>
    prisma.$queryRawUnsafe(
      'SELECT id,migration_name,checksum,finished_at,rolled_back_at,applied_steps_count FROM _prisma_migrations ORDER BY migration_name,id'
    );
  const { MIGRATION_COUNT } = require('/app/scripts/migration-census.cjs');
  const rows = await ledger();
  assert.equal(rows.length, MIGRATION_COUNT);
  assert.ok(rows.every((row) => row.finished_at && !row.rolled_back_at));
  let state;
  if (mode === 'new') {
    assert.equal(fs.existsSync(stateFile), false);
    state = {
      org: randomUUID(),
      buyer: randomUUID(),
      foreignBuyer: randomUUID(),
      event: randomUUID(),
      type: randomUUID(),
      order: null,
      ticket: null,
    };
    save(state); // Allocate cleanup ownership BEFORE any fixture mutation.
  } else state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  for (const key of ['org', 'buyer', 'foreignBuyer', 'event', 'type'])
    assert.match(
      state[key],
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
    );
  const check = () => {
    if (!safe) throw Error('Unjoined work');
  };
  const foreignSnapshot = async () => {
    const result = {};
    for (const [model, where] of [
      ['organization', { id: { not: state.org } }],
      ['user', { id: { notIn: [state.buyer, state.foreignBuyer] } }],
      ['event', { id: { not: state.event } }],
      ['ticketType', { eventId: { not: state.event } }],
      ['order', { eventId: { not: state.event } }],
      ['ticket', { eventId: { not: state.event } }],
    ]) {
      check();
      const rows = await prisma[model].findMany({ where, orderBy: { id: 'asc' }, take: 1001 });
      assert.ok(rows.length <= 1000);
      result[model] = rows;
    }
    return JSON.parse(JSON.stringify(result));
  };
  if (mode === 'new') {
    state.foreign = await foreignSnapshot();
    save(state);
  }
  const cleanup = async () => {
    check();
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: state.org } });
    assert.equal(org.name, 'Task606 synthetic retained organization');
    assert.equal(org.slug, state.org);
    check();
    const event = await prisma.event.findUniqueOrThrow({ where: { id: state.event } });
    assert.equal(event.organizationId, state.org);
    assert.equal(event.name, 'Task606 retained post-upgrade marker');
    for (const id of [state.buyer, state.foreignBuyer]) {
      check();
      const user = await prisma.user.findUniqueOrThrow({ where: { id } });
      assert.equal(user.organizationId, state.org);
      assert.equal(user.email, id + '@example.test');
    }
    check();
    await prisma.ticket.deleteMany({ where: { eventId: state.event } });
    check();
    await prisma.order.deleteMany({ where: { eventId: state.event } });
    check();
    await prisma.ticketType.deleteMany({ where: { id: state.type } });
    check();
    await prisma.event.deleteMany({ where: { id: state.event } });
    check();
    await prisma.user.deleteMany({
      where: { id: { in: [state.buyer, state.foreignBuyer] } },
    });
    check();
    await prisma.organization.deleteMany({ where: { id: state.org } });
    check();
    assert.equal(await prisma.organization.count({ where: { id: state.org } }), 0);
    check();
    assert.equal(
      await prisma.user.count({
        where: { id: { in: [state.buyer, state.foreignBuyer] } },
      }),
      0
    );
    check();
    assert.equal(await prisma.event.count({ where: { id: state.event } }), 0);
    check();
    assert.equal(await prisma.order.count({ where: { eventId: state.event } }), 0);
    check();
    assert.equal(await prisma.ticket.count({ where: { eventId: state.event } }), 0);
  };
  if (mode === 'cleanup') {
    phase = 'cleanup';
    await bounded(cleanup());
    assert.deepEqual(await foreignSnapshot(), state.foreign);
    fs.unlinkSync(stateFile);
    return;
  }
  phase = 'mounted';
  const app = require('/app/dist/app').default;
  server = await new Promise((resolve, reject) => {
    const active = app.listen(0, '127.0.0.1', () => resolve(active));
    active.once('error', reject);
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  async function http(method, route, token, body, status = 200) {
    assert.match(
      route,
      /^\/(?:ready|api\/v1\/(?:auth\/(?:login|me)|events\/[a-f0-9-]+|orders(?:\/[a-f0-9-]+)?|tickets(?:\/mine|\/[a-f0-9-]+)?))$/
    );
    const response = await localFetch(base + route, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, status);
    const data = await response.json();
    if (status < 400 && route !== '/ready') assert.equal(data.success, true);
    return data;
  }
  await http('GET', '/ready');
  // All fixture writes happen AFTER the first new application has started on migrated33.
  if (mode === 'new') {
    phase = 'post-upgrade-write';
    check();
    await prisma.organization.create({
      data: {
        id: state.org,
        name: 'Task606 synthetic retained organization',
        slug: state.org,
        type: 'PROMOTER',
      },
    });
    const passwordHash = await require('/app/node_modules/bcryptjs').hash(
      'Synthetic606Password!',
      10
    );
    for (const id of [state.buyer, state.foreignBuyer]) {
      check();
      await prisma.user.create({
        data: {
          id,
          organizationId: state.org,
          email: id + '@example.test',
          passwordHash,
          firstName: 'Synthetic',
          lastName: 'Rollback',
          role: 'CUSTOMER',
          emailVerified: true,
        },
      });
    }
    check();
    await prisma.event.create({
      data: {
        id: state.event,
        organizationId: state.org,
        name: 'Task606 retained post-upgrade marker',
        slug: state.event,
        tags: [],
        status: 'PUBLISHED',
        startDatetime: new Date(Date.now() + 86400000),
      },
    });
    check();
    await prisma.ticketType.create({
      data: {
        id: state.type,
        eventId: state.event,
        name: 'GA',
        price: 10,
        quantityTotal: 5,
        quantityAvailable: 5,
      },
    });
  }
  const login = await http('POST', '/api/v1/auth/login', null, {
    email: state.buyer + '@example.test',
    password: 'Synthetic606Password!',
  });
  assert.equal(login.data.user.id, state.buyer);
  const token = login.data.accessToken;
  assert.equal(typeof token, 'string');
  if (mode === 'new') {
    phase = 'mounted-write';
    const created = await http(
      'POST',
      '/api/v1/orders',
      token,
      { items: [{ ticketTypeId: state.type, quantity: 1 }] },
      201
    );
    state.order = created.data.id;
    const tickets = await prisma.ticket.findMany({
      where: { eventId: state.event },
    });
    assert.equal(tickets.length, 1);
    state.ticket = tickets[0].id;
    save(state);
  }
  phase = 'read-smokes';
  assert.equal((await http('GET', '/api/v1/auth/me', token)).data.id, state.buyer);
  assert.equal((await http('GET', '/api/v1/events/' + state.event, token)).data.id, state.event);
  assert.equal((await http('GET', '/api/v1/orders/' + state.order, token)).data.id, state.order);
  assert.equal((await http('GET', '/api/v1/tickets/' + state.ticket, token)).data.id, state.ticket);
  assert.ok(
    (await http('GET', '/api/v1/tickets/mine', token)).data.tickets.some(
      (ticket) => ticket.id === state.ticket
    )
  );
  const foreign = require('/app/dist/utils/jwt').generateAccessToken({
    userId: state.foreignBuyer,
    email: state.foreignBuyer + '@example.test',
    role: 'CUSTOMER',
    organizationId: state.org,
    sessionVersion: 0,
    emailVerified: true,
  });
  await http('GET', '/api/v1/orders/' + state.order, foreign, undefined, 404);
  await http('GET', '/api/v1/tickets/' + state.ticket, foreign, undefined, 404);
  // Login legitimately changes lastLogin/updatedAt only; financial/event/ticket rows remain complete.
  const snapshot = {
    org: await prisma.organization.findUnique({ where: { id: state.org } }),
    users: (
      await prisma.user.findMany({
        where: { id: { in: [state.buyer, state.foreignBuyer] } },
        orderBy: { id: 'asc' },
      })
    ).map((row) => {
      const stable = { ...row };
      delete stable.lastLogin;
      delete stable.updatedAt;
      return stable;
    }),
    event: await prisma.event.findUnique({ where: { id: state.event } }),
    stock: await prisma.ticketType.findUnique({ where: { id: state.type } }),
    orders: await prisma.order.findMany({
      where: { eventId: state.event },
      orderBy: { id: 'asc' },
    }),
    tickets: await prisma.ticket.findMany({
      where: { eventId: state.event },
      orderBy: { id: 'asc' },
    }),
    attempts: await prisma.paymentAttempt.findMany({
      where: { orderId: state.order },
    }),
    refunds: await prisma.paymentRefund.findMany({
      where: { orderId: state.order },
    }),
    ledger: await ledger(),
  };
  assert.equal(snapshot.stock.quantityAvailable, 4);
  assert.equal(snapshot.stock.quantityHeld, 1);
  assert.equal(snapshot.stock.quantitySold, 0);
  assert.equal(snapshot.orders[0].status, 'PENDING');
  assert.equal(snapshot.orders[0].paymentIntentId, null);
  assert.equal(snapshot.tickets[0].inventoryState, 'HELD');
  assert.equal(snapshot.attempts.length, 0);
  assert.equal(snapshot.refunds.length, 0);
  const normalized = JSON.parse(JSON.stringify(snapshot));
  if (mode === 'new') {
    state.snapshot = normalized;
    save(state);
  } else assert.deepEqual(normalized, state.snapshot);
  assert.deepEqual(await foreignSnapshot(), state.foreign);
  assert.equal(providerAttempts, 0);
}
if (require.main === module) {
  const watchdog = setTimeout(() => process.exit(1), 80000);
  void (async () => {
    let ok = false;
    let lifetimeCleanupVerified = false;
    try {
      await main();
      ok = true;
    } catch {
      /* Never print assertions, tokens, URLs or provider errors. */
    }
    try {
      if (server)
        await bounded(
          new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
          )
        );
      if (safe && redis) await bounded(redis.disconnectRedis());
      if (safe && prisma) await bounded(prisma.$disconnect());
      lifetimeCleanupVerified = safe;
    } catch {
      ok = false;
    }
    clearTimeout(watchdog);
    process.stdout.write(
      JSON.stringify({
        scope: 'task606-mounted-worker',
        phase,
        mode: ['new', 'old', 'forward', 'cleanup'].includes(process.env.TIXMO_ROLLBACK_PHASE)
          ? process.env.TIXMO_ROLLBACK_PHASE
          : 'unclassified',
        ok: ok && safe && providerAttempts === 0,
        providerAttempts,
        lifetimeCleanupVerified,
      }) + '\n',
      () => process.exit(ok && safe && providerAttempts === 0 ? 0 : 1)
    );
  })();
}
