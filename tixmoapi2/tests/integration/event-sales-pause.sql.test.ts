// SOURCE ONLY: not executed/qualified. Existing Jest setup requires a separately
// granted, sole-owner disposable Postgres target and applies schema before imports.
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import prisma from '../../src/config/prisma';
import { EventService } from '../../src/api/events/service';
import { OrderService } from '../../src/api/orders/service';
import { randomUUID } from 'crypto';

// Reuse fixture/gate/real-lock observation patterns from
// order-cancel-stale-observation and order-refund-current-path, not a new runner.
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Sales pause harness deadline')), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
// Own whole test bodies too: Jest timeout does not cancel their SQL promises.
const live = new Set<Promise<unknown>>();
const fixtures: Array<{ orgId: string; userId: string; eventId: string; typeId: string }> = [];
const restorers = new Set<() => void>();
let failClosed: Error | undefined;
function owned(operation: () => Promise<void>): Promise<void> {
  const work = operation();
  live.add(work);
  void work.then(
    () => live.delete(work),
    () => live.delete(work)
  );
  return work;
}
function preserve(error: unknown): never {
  failClosed = new Error(
    'Owned operations/cleanup did not settle safely; STOP suite and preserve fixture IDs: ' +
      JSON.stringify(fixtures)
  );
  console.error(failClosed.message, error);
  throw failClosed;
}
// The observer can outlive bounded's race and the owning test body. Preserve
// conservatively on ANY observer failure, before request drain or hook teardown.
// This latch is not cancellation; even later settlement cannot authorize reuse.
async function observe<T>(work: Promise<T>): Promise<T> {
  try {
    return await bounded(work);
  } catch (error) {
    preserve(error);
  }
}
beforeEach(() => {
  if (failClosed) throw failClosed;
});
afterEach(async () => {
  try {
    // A timeout race is NOT SQL cancellation. No cleanup or next test on failure.
    if (failClosed) throw failClosed;
    await bounded(Promise.allSettled([...live]));
  } catch (error) {
    preserve(error);
  } finally {
    for (const restore of restorers) restore();
    restorers.clear();
  }
  try {
    // Only synthetic owned rows on the separately authorized disposable DB.
    // Explicit test audit deletion respects the product's intentional RESTRICT;
    // this is not a product retention/pruning policy.
    await bounded(
      prisma.$transaction(
        async (tx) => {
          for (const ids of fixtures) {
            await tx.eventSalesControl.deleteMany({ where: { eventId: ids.eventId } });
            await tx.ticket.deleteMany({ where: { eventId: ids.eventId } });
            await tx.order.deleteMany({ where: { eventId: ids.eventId } });
            await tx.ticketType.deleteMany({ where: { id: ids.typeId } });
            await tx.event.deleteMany({ where: { id: ids.eventId } });
            await tx.user.deleteMany({ where: { id: ids.userId } });
            await tx.organization.deleteMany({ where: { id: ids.orgId } });
          }
        },
        { maxWait: 2000, timeout: 4000 }
      )
    );
    fixtures.length = 0;
  } catch (error) {
    preserve(error);
  }
}, 12000);
afterAll(async () => {
  // No pretend cancellation or disconnect against possibly live SQL. On failure
  // an external disposable-target owner must reap the process/DB before reuse.
  if (failClosed) throw failClosed;
  try {
    await bounded(prisma.$disconnect());
  } catch (error) {
    preserve(error);
  }
});

async function fixture(status: 'PUBLISHED' | 'ON_SALE' = 'ON_SALE') {
  const key = randomUUID();
  const ids = {
    orgId: randomUUID(),
    userId: randomUUID(),
    eventId: randomUUID(),
    typeId: randomUUID(),
  };
  fixtures.push(ids); // before first INSERT: partial/ambiguous setup remains owned
  const org = await prisma.organization.create({
    data: { id: ids.orgId, name: key, slug: key, type: 'PROMOTER' },
  });
  const user = await prisma.user.create({
    data: {
      id: ids.userId,
      email: key + '@example.test',
      passwordHash: 'synthetic',
      firstName: 'Fixture',
      lastName: '493',
      role: 'MANAGER',
      organizationId: org.id,
    },
  });
  const event = await prisma.event.create({
    data: {
      id: ids.eventId,
      organizationId: org.id,
      name: key,
      slug: key,
      tags: [],
      status,
      salesStart: new Date(Date.now() - 86400000),
      salesEnd: new Date(Date.now() + 86400000),
      startDatetime: new Date(Date.now() + 172800000),
    },
  });
  const type = await prisma.ticketType.create({
    data: {
      id: ids.typeId,
      eventId: event.id,
      name: key,
      price: 10,
      quantityTotal: 10,
      quantityAvailable: 10,
    },
  });
  const actor = { userId: user.id, email: user.email, role: user.role, organizationId: org.id };
  const control = (
    paused: boolean,
    requestId = randomUUID(),
    reason = 'Synthetic incident review'
  ) => new EventService().setSalesPause(event.id, { paused, requestId, reason }, actor);
  const create = () =>
    new OrderService().createOrder(user.id, { items: [{ ticketTypeId: type.id, quantity: 1 }] });
  const snapshot = async () => ({
    event: await prisma.event.findUniqueOrThrow({ where: { id: event.id } }),
    stock: await prisma.ticketType.findUniqueOrThrow({ where: { id: type.id } }),
    orders: await prisma.order.findMany({
      where: { eventId: event.id },
      include: { tickets: true },
      orderBy: { id: 'asc' },
    }),
    audit: await prisma.eventSalesControl.findMany({
      where: { eventId: event.id },
      orderBy: { id: 'asc' },
    }),
  });
  return { event, type, actor, control, create, snapshot };
}

test.each(['PUBLISHED', 'ON_SALE'] as const)(
  '%s rejects paused new orders; explicit resume preserves event and stock',
  (status) =>
    owned(async () => {
      const f = await fixture(status);
      const before = await f.snapshot();
      await f.control(true);
      const paused = await f.snapshot();
      expect(paused.event).toEqual({
        ...before.event,
        salesPaused: true,
        updatedAt: expect.any(Date),
      });
      expect(paused.stock).toEqual(before.stock);
      await expect(f.create()).rejects.toMatchObject({
        statusCode: 409,
        errors: { code: 'SALES_PAUSED' },
      });
      expect(await f.snapshot()).toEqual(paused);
      await f.control(false);
      const resumed = await f.snapshot();
      expect(resumed.event).toEqual({ ...before.event, updatedAt: expect.any(Date) });
      expect(resumed.stock).toEqual(before.stock);
      await expect(f.create()).resolves.toMatchObject({ eventId: f.event.id, status: 'PENDING' });
      const after = await f.snapshot();
      expect(after.orders).toHaveLength(1);
      expect([after.stock.quantityAvailable, after.stock.quantityHeld]).toEqual([9, 1]);
    })
);

test.each(['lifecycle', 'window', 'stock'] as const)(
  'resume cannot repair an ineligible %s',
  (condition) =>
    owned(async () => {
      const f = await fixture();
      await f.control(true);
      if (condition === 'lifecycle')
        await prisma.event.update({ where: { id: f.event.id }, data: { status: 'SOLD_OUT' } });
      if (condition === 'window')
        await prisma.event.update({ where: { id: f.event.id }, data: { salesEnd: new Date(0) } });
      if (condition === 'stock')
        await prisma.ticketType.update({
          where: { id: f.type.id },
          data: { quantityAvailable: 0 },
        });
      const before = await f.snapshot();
      await f.control(false);
      const resumed = await f.snapshot();
      expect(resumed.event).toEqual({
        ...before.event,
        salesPaused: false,
        updatedAt: expect.any(Date),
      });
      expect(resumed.stock).toEqual(before.stock);
      await expect(f.create()).rejects.toMatchObject({ statusCode: 400 });
      expect(await f.snapshot()).toEqual(resumed);
    })
);

test('same UUID is historical replay after resume; conflict and no-op preserve evidence semantics', () =>
  owned(async () => {
    const f = await fixture();
    const requestId = randomUUID();
    const first = await f.control(true, requestId);
    const paused = await f.snapshot();
    expect(paused.audit).toHaveLength(1);
    expect(paused.audit[0]).toMatchObject({
      actorId: f.actor.userId,
      organizationId: f.actor.organizationId,
      eventId: f.event.id,
      requestId,
      beforePaused: false,
      afterPaused: true,
      createdAt: expect.any(Date),
    });
    await expect(f.control(true, requestId)).resolves.toEqual({ ...first, replayed: true });
    expect(await f.snapshot()).toEqual(paused);
    await expect(f.control(false, requestId)).rejects.toMatchObject({
      statusCode: 409,
      errors: { code: 'SALES_PAUSE_REQUEST_CONFLICT' },
    });
    await expect(f.control(true, requestId, 'Different reason')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(await f.snapshot()).toEqual(paused);
    const noop = await f.control(true);
    expect(noop.changed).toBe(false);
    const nooped = await f.snapshot();
    expect(nooped.audit).toHaveLength(2);
    expect(nooped.audit.find((row) => row.id === noop.auditId)).toMatchObject({
      beforePaused: true,
      afterPaused: true,
    });
    await f.control(false);
    const resumed = await f.snapshot();
    await expect(f.control(true, requestId)).resolves.toEqual({ ...first, replayed: true });
    expect(await f.snapshot()).toEqual(resumed);
    expect(resumed.event.salesPaused).toBe(false);
    expect(resumed.audit).toHaveLength(3);
  }));

// Only wrap the transaction callback: every lock/read/write still reaches SQL.
// The seam permits a deterministic barrier or a genuine FK failure, not mocked DB results.
function interceptTransaction(wrap: (tx: any) => any) {
  const original = prisma.$transaction.bind(prisma);
  const spy = jest
    .spyOn(prisma, '$transaction')
    .mockImplementation(((callback: any, options: any) =>
      original((tx: any) => callback(wrap(tx)), options)) as any);
  restorers.add(() => spy.mockRestore());
  return spy;
}

test('actual audit INSERT FK failure leaves event, stock, orders and evidence unchanged', () =>
  owned(async () => {
    const f = await fixture();
    const before = await f.snapshot();
    const spy = interceptTransaction(
      (tx) =>
        new Proxy(tx, {
          get(target, property) {
            if (property === 'eventSalesControl')
              return new Proxy(target.eventSalesControl, {
                get(model, method) {
                  if (method === 'create')
                    return (args: any) =>
                      model.create({ ...args, data: { ...args.data, eventId: randomUUID() } });
                  return Reflect.get(model, method);
                },
              });
            return Reflect.get(target, property);
          },
        })
    );
    try {
      await expect(f.control(true)).rejects.toMatchObject({ code: 'P2003' });
    } finally {
      spy.mockRestore();
    }
    expect(await f.snapshot()).toEqual(before);
  }));

test.each(['pause', 'create'] as const)(
  '%s serialized first holds the actual event row; later operation observes committed state',
  (first) =>
    owned(async () => {
      const f = await fixture();
      const arrived = gate(),
        release = gate();
      let gated = false,
        holderPid = 0;
      const spy = interceptTransaction(
        (tx) =>
          new Proxy(tx, {
            get(target, property) {
              if (property === 'event')
                return new Proxy(target.event, {
                  get(model, method) {
                    if (method === 'findUnique' || method === 'findUniqueOrThrow')
                      return async (args: any) => {
                        const row = await model[method](args);
                        if (args.where.id === f.event.id && !gated) {
                          gated = true;
                          const rows = await target.$queryRaw`SELECT pg_backend_pid() AS pid`;
                          holderPid = rows[0].pid;
                          arrived.resolve();
                          await bounded(release.promise);
                        }
                        return row;
                      };
                    return Reflect.get(model, method);
                  },
                });
              return Reflect.get(target, property);
            },
          })
      );
      const requests: Promise<any>[] = [];
      const start = (operation: () => Promise<any>) => {
        const request = operation();
        void request.catch(() => undefined);
        requests.push(request);
        return request;
      };
      try {
        const earlier = start(first === 'pause' ? () => f.control(true) : f.create);
        await bounded(arrived.promise);
        const later = start(first === 'pause' ? f.create : () => f.control(true));
        let blocked = 0;
        await observe(
          (async () => {
            const deadline = Date.now() + 3000;
            while (!blocked && Date.now() < deadline) {
              const rows = await prisma.$queryRaw<
                Array<{ count: bigint }>
              >`SELECT count(*) AS count FROM pg_stat_activity WHERE ${holderPid} = ANY(pg_blocking_pids(pid))`;
              blocked = Number(rows[0].count);
              if (!blocked) await new Promise((done) => setTimeout(done, 10));
            }
          })()
        );
        expect(blocked).toBeGreaterThan(0);
        expect(await prisma.order.count({ where: { eventId: f.event.id } })).toBe(0);
        release.resolve();
        await earlier;
        if (first === 'pause')
          await expect(later).rejects.toMatchObject({
            statusCode: 409,
            errors: { code: 'SALES_PAUSED' },
          });
        else await later;
        const after = await f.snapshot();
        expect(after.event.salesPaused).toBe(true);
        expect(after.orders).toHaveLength(first === 'create' ? 1 : 0);
        expect([after.stock.quantityAvailable, after.stock.quantityHeld]).toEqual(
          first === 'create' ? [9, 1] : [10, 0]
        );
        expect(after.audit).toHaveLength(1);
        await expect(f.create()).rejects.toMatchObject({ errors: { code: 'SALES_PAUSED' } });
        expect(await f.snapshot()).toEqual(after);
      } finally {
        release.resolve();
        try {
          await bounded(Promise.allSettled(requests));
        } catch (error) {
          preserve(error);
        } finally {
          spy.mockRestore();
        }
      }
    }),
  20000
);

test('generic writer carrying stale pause=false cannot clear a committed pause', () =>
  owned(async () => {
    const f = await fixture();
    const stale = await f.snapshot();
    await f.control(true);
    const paused = await f.snapshot();
    await new EventService().updateEvent(f.event.id, {
      title: 'Synthetic stale edit',
      status: stale.event.status,
      salesPaused: stale.event.salesPaused,
    } as any);
    const after = await f.snapshot();
    expect(after.event).toEqual({
      ...paused.event,
      name: 'Synthetic stale edit',
      updatedAt: expect.any(Date),
    });
    expect(after.stock).toEqual(paused.stock);
    expect(after.audit).toEqual(paused.audit);
    expect(after.orders).toEqual(paused.orders);
    await expect(f.create()).rejects.toMatchObject({ errors: { code: 'SALES_PAUSED' } });
  }));
