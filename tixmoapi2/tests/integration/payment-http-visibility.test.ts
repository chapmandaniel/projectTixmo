// Synthetic application callback latency only: real raw-body/signature/HTTP/SQL paths.
import { randomUUID } from 'crypto';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import fs from 'fs';
import path from 'path';
import request from 'supertest';

const mockIntents = new Map<string, any>();
const mockOrders = new Map<string, { buyer: string; amount: number }>();
const mockReceipts = new Map<string, number>();
let mockUnexpected = 0,
  mockCreates = 0;
const mockRefuse = () => {
  mockUnexpected++;
  throw Error('Payment visibility fixture refuses external transport');
};
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('../../src/config/logger', () => ({
  logger: { info() {}, warn() {}, error() {}, debug() {}, http() {} },
}));
jest.mock('../../src/config/email', () => ({
  emailFrom: { name: 'Synthetic', address: 'synthetic@example.test' },
  transporter: {
    sendMail: (mail: { to: unknown; subject: unknown; html: unknown; text: unknown }) => {
      if (
        typeof mail.to !== 'string' ||
        !mockReceipts.has(mail.to) ||
        typeof mail.subject !== 'string' ||
        typeof mail.html !== 'string' ||
        typeof mail.text !== 'string'
      )
        return mockRefuse();
      mockReceipts.set(mail.to, mockReceipts.get(mail.to)! + 1);
      return Promise.resolve({ messageId: 'synthetic-transport-ack' });
    },
    verify: mockRefuse,
  },
}));
jest.mock('stripe', () => {
  const RealStripe = jest.requireActual('stripe');
  return jest.fn().mockImplementation(() => ({
    webhooks: RealStripe.webhooks,
    paymentIntents: {
      create: (params: any, options: any) => {
        const owned = mockOrders.get(params.metadata?.orderId);
        if (
          !owned ||
          params.metadata.userId !== owned.buyer ||
          params.amount !== owned.amount ||
          params.currency !== 'cad' ||
          !/^[a-f0-9-]{36}$/.test(params.metadata.attemptId) ||
          options.idempotencyKey !== `payment-${params.metadata.attemptId}`
        )
          return mockRefuse();
        const id = `pi_${params.metadata.attemptId}`;
        if (mockIntents.has(id)) return mockRefuse();
        mockCreates++;
        const intent = {
          ...params,
          id,
          object: 'payment_intent',
          client_secret: `${id}_synthetic`,
          status: 'requires_payment_method',
          amount_received: 0,
        };
        mockIntents.set(id, intent);
        return Promise.resolve(intent);
      },
      retrieve: (id: string) =>
        mockIntents.has(id) ? Promise.resolve(mockIntents.get(id)) : mockRefuse(),
      cancel: mockRefuse,
      search: mockRefuse,
    },
    refunds: new Proxy({}, { get: () => mockRefuse }),
    events: new Proxy({}, { get: () => mockRefuse }),
  }));
});

it('twenty owned buyers receive one paid ticket through authentic signed mounted callbacks and first QR reads', async () => {
  require('../../../scripts/verification-safety.cjs').validateVerificationTargets(process.env);
  const { observeFunction } = require('../../../scripts/soak-lifetime.cjs');
  const { percentile } = require('../../../scripts/http-pressure-receipt.cjs');
  const ids = {
    org: randomUUID(),
    event: randomUUID(),
    type: randomUUID(),
    buyers: Array.from({ length: 20 }, () => randomUUID()),
    events: Array.from({ length: 40 }, () => `evt_${randomUUID()}`),
    foreign: {
      org: randomUUID(),
      event: randomUUID(),
      type: randomUUID(),
      buyer: randomUUID(),
      order: randomUUID(),
      ticket: randomUUID(),
    },
  };
  const eventIds = [ids.event, ids.foreign.event],
    userIds = [...ids.buyers, ids.foreign.buyer];
  let unsafe = false,
    primary: unknown,
    bodyWork: Promise<void> | undefined,
    server: Server | undefined;
  const pending = new Set<Promise<unknown>>(),
    backgroundErrors: unknown[] = [];
  const check = () => {
    if (unsafe) throw Error('Payment HTTP work is unjoined');
  };
  const track = <T>(promise: Promise<T>, report = true) => {
    pending.add(promise);
    void promise.then(
      () => pending.delete(promise),
      (error) => {
        pending.delete(promise);
        if (report) backgroundErrors.push(error);
      }
    );
    return promise;
  };
  const bounded = async <T>(promise: Promise<T>, ms = 12000): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            unsafe = true;
            reject(Error('Payment HTTP deadline'));
          }, ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const db = <T>(work: () => Promise<T>) => {
    check();
    return bounded(track(work()));
  };
  const drain = async () => {
    while (pending.size) await Promise.allSettled([...pending]);
  };
  const spies: Array<{ mockRestore: () => void }> = [];
  const dotenv = require('dotenv') as typeof import('dotenv');
  spies.push(jest.spyOn(dotenv, 'config').mockReturnValue({ parsed: {} }));
  const { config } = await import('../../src/config/environment');
  for (const [name, value] of [
    ['stripeSecretKey', ['sk', 'test', 'task616_synthetic'].join('_')],
    ['stripeWebhookSecret', 'whsec_task616_synthetic'],
    ['paymentCurrency', 'cad'],
    ['rateLimitReadMax', 10000],
    ['rateLimitWriteMax', 4000],
    ['waitingRoomMaxConcurrentRequests', 4000],
    ['redisDb', Number(new URL(process.env.REDIS_URL!).pathname.slice(1))],
  ] as const) {
    const replacement = jest.replaceProperty(config, name, value);
    spies.push({ mockRestore: () => replacement.restore() });
  }
  const redisModule = await import('../../src/config/redis');
  const prisma = (await import('../../src/config/prisma')).default;
  let redis: Awaited<ReturnType<typeof redisModule.connectRedis>> | undefined;
  const clients: Array<Promise<unknown>> = [];
  let receipt: Record<string, unknown> | undefined,
    receiptIdentity: { dev: number; ino: number } | undefined;
  const receiptPath = path.resolve(__dirname, '../../../runtime/task616-payment-http.json');
  const writeReceipt = () => {
    if (!receipt) return;
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    if (!receiptIdentity) {
      fs.writeFileSync(receiptPath, JSON.stringify(receipt) + '\n', { flag: 'wx', mode: 0o600 });
      receiptIdentity = fs.lstatSync(receiptPath);
    } else {
      const stat = fs.lstatSync(receiptPath);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.dev !== receiptIdentity.dev ||
        stat.ino !== receiptIdentity.ino
      )
        throw Error('Payment receipt changed');
      fs.writeFileSync(receiptPath, JSON.stringify(receipt) + '\n');
    }
  };
  const body = async () => {
    expect(fs.existsSync(receiptPath)).toBe(false);
    mockIntents.clear();
    mockOrders.clear();
    mockReceipts.clear();
    mockUnexpected = 0;
    mockCreates = 0;
    redis = await db(() => redisModule.connectRedis());
    expect(redis.isReady).toBe(true);
    for (const name of ['sendCommand', 'zRem', 'eval'])
      spies.push(observeFunction(redis, name, track));
    const asyncModule = await import('../../src/utils/catchAsync');
    spies.push(
      jest.spyOn(asyncModule, 'catchAsync').mockImplementation((fn) => (req, res, next) => {
        void track(Promise.resolve(fn(req, res, next)), false).catch(next);
      })
    );
    const auth = await import('../../src/middleware/auth'),
      limiter = await import('../../src/middleware/rateLimiter'),
      waiting = await import('../../src/middleware/waitingRoom');
    for (const [module, names] of [
      [auth, ['authenticate', 'optionalAuthenticate']],
      [limiter, ['authRateLimiter', 'apiReadRateLimiter', 'apiWriteRateLimiter']],
      [waiting, ['waitingRoom']],
    ] as Array<[any, string[]]>)
      for (const name of names) spies.push(observeFunction(module, name, track));
    const validation = await import('../../src/middleware/validate'),
      actualValidate = validation.validate;
    spies.push(
      jest.spyOn(validation, 'validate').mockImplementation((schema) => {
        const handler = actualValidate(schema);
        return (...args: Parameters<typeof handler>) => track(Promise.resolve(handler(...args)));
      })
    );
    const app = (await import('../../src/app')).default;
    const { generateAccessToken } = await import('../../src/utils/jwt');
    const RealStripe = jest.requireActual<typeof import('stripe').default>('stripe');
    const { generateQRCode, generateTicketQRData } = await import('../../src/utils/qrcode');
    const leaseBefore = await db(() => redis!.zCard(waiting.ACTIVE_REQUESTS_KEY));
    const buyers = ids.buyers.map((id, i) => ({
      id,
      email: `${id}@example.test`,
      passwordHash: 'synthetic',
      firstName: 'Synthetic',
      lastName: `Buyer${i}`,
      emailVerified: true,
      sessionVersion: 0,
    }));
    await db(() =>
      prisma.user.createMany({
        data: [
          ...buyers,
          { ...buyers[0], id: ids.foreign.buyer, email: `${ids.foreign.buyer}@example.test` },
        ],
      })
    );
    for (const scope of [ids, ids.foreign]) {
      await db(() =>
        prisma.organization.create({
          data: { id: scope.org, name: scope.org, slug: scope.org, type: 'PROMOTER' },
        })
      );
      await db(() =>
        prisma.event.create({
          data: {
            id: scope.event,
            organizationId: scope.org,
            name: scope.event,
            slug: scope.event,
            tags: [],
            status: 'PUBLISHED',
            startDatetime: new Date(Date.now() + 86400000),
          },
        })
      );
      await db(() =>
        prisma.ticketType.create({
          data: {
            id: scope.type,
            eventId: scope.event,
            name: 'GA',
            price: 10,
            quantityTotal: scope === ids ? 20 : 1,
            quantityAvailable: scope === ids ? 20 : 0,
            quantitySold: scope === ids ? 0 : 1,
          },
        })
      );
    }
    await db(() =>
      prisma.order.create({
        data: {
          id: ids.foreign.order,
          orderNumber: ids.foreign.order,
          userId: ids.foreign.buyer,
          eventId: ids.foreign.event,
          totalAmount: 10,
          currency: 'cad',
          status: 'PAID',
          paymentStatus: 'SUCCEEDED',
          receiptStatus: 'SENT',
          receiptSentAt: new Date(),
        },
      })
    );
    await db(() =>
      prisma.ticket.create({
        data: {
          id: ids.foreign.ticket,
          orderId: ids.foreign.order,
          userId: ids.foreign.buyer,
          eventId: ids.foreign.event,
          ticketTypeId: ids.foreign.type,
          barcode: ids.foreign.ticket,
          pricePaid: 10,
          inventoryState: 'SOLD',
          status: 'VALID',
        },
      })
    );
    const foreign = async () => ({
      organization: await db(() =>
        prisma.organization.findUnique({ where: { id: ids.foreign.org } })
      ),
      event: await db(() => prisma.event.findUnique({ where: { id: ids.foreign.event } })),
      stock: await db(() => prisma.ticketType.findUnique({ where: { id: ids.foreign.type } })),
      user: await db(() => prisma.user.findUnique({ where: { id: ids.foreign.buyer } })),
      order: await db(() =>
        prisma.order.findUnique({ where: { id: ids.foreign.order }, include: { tickets: true } })
      ),
      attempts: await db(() =>
        prisma.paymentAttempt.findMany({
          where: { orderId: ids.foreign.order },
          orderBy: { id: 'asc' },
        })
      ),
      refunds: await db(() =>
        prisma.paymentRefund.findMany({
          where: { orderId: ids.foreign.order },
          orderBy: { id: 'asc' },
        })
      ),
    });
    const foreignBefore = await foreign();
    const tokens = buyers.map((b) =>
      generateAccessToken({
        userId: b.id,
        email: b.email,
        role: 'CUSTOMER',
        sessionVersion: 0,
        emailVerified: true,
      })
    );
    const foreignToken = generateAccessToken({
      userId: ids.foreign.buyer,
      email: `${ids.foreign.buyer}@example.test`,
      role: 'CUSTOMER',
      sessionVersion: 0,
      emailVerified: true,
    });
    for (const b of buyers) mockReceipts.set(b.email, 0);
    server = createServer(app);
    await bounded(
      track(
        new Promise<void>((resolve, reject) => {
          server!.once('error', reject);
          server!.listen(0, '127.0.0.1', () => {
            server!.off('error', reject);
            resolve();
          });
        })
      )
    );
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    let inFlight = 0,
      maxInFlight = 0,
      httpCalls = 0;
    const http = async (
      method: 'get' | 'post',
      route: string,
      token?: string,
      payload?: string | object,
      signature?: string
    ) => {
      check();
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      httpCalls++;
      try {
        const client = request(url)[method](route).set('X-Forwarded-For', '127.0.0.1');
        if (token) client.set('Authorization', `Bearer ${token}`);
        if (signature)
          client.set('stripe-signature', signature).set('Content-Type', 'application/json');
        if (payload !== undefined) client.send(payload);
        return await client.timeout({ response: 5000, deadline: 8000 });
      } finally {
        inFlight--;
      }
    };
    const pool = async <T>(items: T[], work: (item: T, index: number) => Promise<void>) => {
      let next = 0;
      const workers = Array.from({ length: Math.min(4, items.length) }, async () => {
        for (;;) {
          check();
          const index = next++;
          if (index >= items.length) return;
          await work(items[index], index);
        }
      });
      const owned = workers.map((worker) => track(worker, false));
      clients.push(...owned);
      await Promise.all(owned);
    };
    const preparations: Array<{ order: string; intent: string; intentAt: number }> = [];
    await pool(buyers, async (b, index) => {
      const reserved = await http('post', '/api/v1/orders', tokens[index], {
        items: [{ ticketTypeId: ids.type, quantity: 1 }],
      });
      expect(reserved.status).toBe(201);
      const order = reserved.body.data;
      expect(typeof order.id).toBe('string');
      mockOrders.set(order.id, {
        buyer: b.id,
        amount: Math.round(Number(order.totalAmount) * 100),
      });
      const intentAt = performance.now();
      const prepared = await http('post', '/api/v1/payments/create-intent', tokens[index], {
        orderId: order.id,
      });
      expect(prepared.status).toBe(200);
      expect(typeof prepared.body.data.clientSecret).toBe('string');
      expect(mockIntents.has(prepared.body.data.paymentIntentId)).toBe(true);
      preparations[index] = {
        order: order.id,
        intent: prepared.body.data.paymentIntentId,
        intentAt,
      };
    });
    const financial = async () => ({
      orders: await db(() =>
        prisma.order.findMany({ where: { eventId: ids.event }, orderBy: { id: 'asc' } })
      ),
      tickets: await db(() =>
        prisma.ticket.findMany({ where: { eventId: ids.event }, orderBy: { id: 'asc' } })
      ),
      stock: await db(() => prisma.ticketType.findUniqueOrThrow({ where: { id: ids.type } })),
      attempts: await db(() =>
        prisma.paymentAttempt.findMany({
          where: { orderId: { in: preparations.map((p) => p.order) } },
          orderBy: { id: 'asc' },
        })
      ),
      refunds: await db(() =>
        prisma.paymentRefund.findMany({
          where: { orderId: { in: preparations.map((p) => p.order) } },
        })
      ),
    });
    const pendingBefore = await financial();
    expect(pendingBefore.stock).toMatchObject({
      quantityAvailable: 0,
      quantityHeld: 20,
      quantitySold: 0,
    });
    expect(
      pendingBefore.tickets.every((t) => t.qrCodeUrl === null && t.inventoryState === 'HELD')
    ).toBe(true);
    const event = (index: number, id: string) => ({
      id,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: { object: { ...mockIntents.get(preparations[index].intent) } },
    });
    const deliver = (value: any) => {
      const payload = JSON.stringify(value);
      const signature = RealStripe.webhooks.generateTestHeaderString({
        payload,
        secret: config.stripeWebhookSecret,
      });
      return http('post', '/api/v1/payments/webhook', undefined, payload, signature);
    };
    const wrong = JSON.stringify(event(0, ids.events[0]));
    const wrongSignature = RealStripe.webhooks.generateTestHeaderString({
      payload: wrong,
      secret: 'whsec_deliberately_wrong_synthetic',
    });
    expect(
      (await http('post', '/api/v1/payments/webhook', undefined, wrong, wrongSignature)).status
    ).toBe(400);
    const correctSignature = RealStripe.webhooks.generateTestHeaderString({
      payload: wrong,
      secret: config.stripeWebhookSecret,
    });
    expect(
      (await http('post', '/api/v1/payments/webhook', undefined, wrong + ' ', correctSignature))
        .status
    ).toBe(400);
    await bounded(drain());
    expect(await financial()).toEqual(pendingBefore);
    expect(
      await db(() => prisma.paymentWebhookEvent.count({ where: { id: { in: ids.events } } }))
    ).toBe(0);
    const paidMs: number[] = [],
      intentMs: number[] = [];
    const ticketIds: string[] = [];
    const firstEvents: any[] = [];
    await pool(preparations, async (p, index) => {
      const intent = mockIntents.get(p.intent);
      intent.status = 'succeeded';
      intent.amount_received = intent.amount;
      const paidAt = performance.now();
      const value = event(index, ids.events[index]);
      firstEvents[index] = value;
      const ack = await deliver(value);
      expect(ack.status).toBe(200);
      expect(ack.body.received).toBe(true);
      const wallet = await http('get', '/api/v1/tickets/mine?limit=100', tokens[index]);
      expect(wallet.status).toBe(200);
      const tickets = wallet.body.data.tickets;
      expect(tickets).toHaveLength(1);
      const ticket = tickets[0];
      expect(ticket).toMatchObject({
        orderId: p.order,
        userId: ids.buyers[index],
        eventId: ids.event,
        inventoryState: 'SOLD',
        status: 'VALID',
        order: expect.objectContaining({ status: 'PAID' }),
      });
      ticketIds[index] = ticket.id;
      const qr = await http('get', `/api/v1/tickets/${ticket.id}/qr`, tokens[index]);
      expect(qr.status).toBe(200);
      expect(qr.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
      const visibleAt = performance.now();
      paidMs.push(visibleAt - paidAt);
      intentMs.push(visibleAt - p.intentAt);
      expect(qr.body.data.qrCode).toBe(
        await generateQRCode(generateTicketQRData(ticket.id, ticket.barcode, ticket.eventId))
      );
    });
    await bounded(drain());
    // First real QR caches qrCodeUrl/updatedAt; the replay baseline is intentionally AFTER that legitimate write.
    const settled = await financial();
    expect(settled.orders).toHaveLength(20);
    expect(settled.tickets).toHaveLength(20);
    expect(settled.attempts).toHaveLength(20);
    expect(settled.refunds).toHaveLength(0);
    expect(settled.stock).toMatchObject({
      quantityTotal: 20,
      quantityAvailable: 0,
      quantityHeld: 0,
      quantitySold: 20,
    });
    expect(new Set(settled.tickets.map((t) => t.barcode)).size).toBe(20);
    expect(new Set(ticketIds).size).toBe(20);
    expect(new Set(settled.orders.map((o) => o.orderNumber)).size).toBe(20);
    for (let index = 0; index < 20; index++) {
      expect(settled.orders.find((o) => o.id === preparations[index].order)).toMatchObject({
        userId: ids.buyers[index],
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        paymentIntentId: preparations[index].intent,
        receiptStatus: 'SENT',
        receiptSentAt: expect.any(Date),
      });
      expect(settled.attempts.find((a) => a.orderId === preparations[index].order)).toMatchObject({
        paymentIntentId: preparations[index].intent,
        id: mockIntents.get(preparations[index].intent).metadata.attemptId,
        amount: mockOrders.get(preparations[index].order)!.amount,
        currency: 'cad',
      });
      expect(mockReceipts.get(buyers[index].email)).toBe(1);
    }
    expect((await http('get', `/api/v1/tickets/${ids.foreign.ticket}/qr`, tokens[0])).status).toBe(
      403
    );
    expect((await http('get', `/api/v1/tickets/${ticketIds[0]}/qr`, foreignToken)).status).toBe(
      403
    );
    const foreignWallet = await http('get', '/api/v1/tickets/mine?limit=100', foreignToken);
    expect(foreignWallet.status).toBe(200);
    expect(foreignWallet.body.data.tickets.map((t: any) => t.id)).toEqual([ids.foreign.ticket]);
    const initialRows = await db(() =>
      prisma.paymentWebhookEvent.findMany({
        where: { id: { in: ids.events.slice(0, 20) } },
        orderBy: { id: 'asc' },
      })
    );
    expect(initialRows).toHaveLength(20);
    expect(initialRows.every((row) => row.status === 'PROCESSED')).toBe(true);
    const duplicateValues = firstEvents.flatMap((value, index) => [
      value,
      { ...value, id: ids.events[index + 20] },
    ]);
    await pool(duplicateValues, async (value) => {
      const ack = await deliver(value);
      expect(ack.status).toBe(200);
      expect(ack.body.received).toBe(true);
    });
    await bounded(drain());
    expect(await financial()).toEqual(settled);
    expect(await foreign()).toEqual(foreignBefore);
    expect(
      await db(() =>
        prisma.paymentWebhookEvent.findMany({
          where: { id: { in: ids.events.slice(0, 20) } },
          orderBy: { id: 'asc' },
        })
      )
    ).toEqual(initialRows);
    expect(
      await db(() =>
        prisma.paymentWebhookEvent.count({ where: { id: { in: ids.events }, status: 'PROCESSED' } })
      )
    ).toBe(40);
    expect([...mockReceipts.values()].every((n) => n === 1)).toBe(true);
    expect(mockCreates).toBe(20);
    expect(mockUnexpected).toBe(0);
    expect(backgroundErrors).toEqual([]);
    expect(paidMs).toHaveLength(20);
    expect(intentMs).toHaveLength(20);
    const paidToQrP95Ms = percentile(paidMs, 0.95),
      intentToQrP95Ms = percentile(intentMs, 0.95);
    expect(paidToQrP95Ms).toBeLessThanOrEqual(30000);
    expect(intentToQrP95Ms).toBeLessThanOrEqual(30000);
    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(inFlight).toBe(0);
    const leaseDelta = (await db(() => redis!.zCard(waiting.ACTIVE_REQUESTS_KEY))) - leaseBefore;
    expect(leaseDelta).toBe(0);
    receipt = {
      scope: 'task616-synthetic-http-paid-to-ticket',
      syntheticReadMax: 10000,
      syntheticWriteMax: 4000,
      syntheticAdmissionMax: 4000,
      limitsQualified: false,
      sourceSha: process.env.TIXMO_PAID_SOURCE_SHA || 'local-synthetic',
      runId: process.env.TIXMO_PAID_RUN_ID || 'local-synthetic',
      samples: 20,
      concurrency: 4,
      maxHttpInFlight: maxInFlight,
      httpCalls,
      paidToQrP95Ms,
      intentToQrP95Ms,
      paidToQrMaxMs: Math.max(...paidMs),
      intentToQrMaxMs: Math.max(...intentMs),
      intentCreates: mockCreates,
      receipts: [...mockReceipts.values()].reduce((a, b) => a + b, 0),
      duplicateCallbacks: 40,
      processedEvents: 40,
      sold: 20,
      held: 0,
      available: 0,
      unexpectedTransport: mockUnexpected,
      leaseDelta,
      signatureDenials: 2,
      passed: false,
      firstQrMeasured: true,
      financialReplayUnchanged: true,
      foreignUnchanged: true,
      cleanupVerified: false,
      lifetimeCleanupVerified: false,
      externalProviderQualified: false,
    };
    writeReceipt();
  };
  try {
    bodyWork = body();
    await bounded(bodyWork, 180000);
  } catch (error) {
    primary = error;
  } finally {
    try {
      await bounded(Promise.allSettled([...(bodyWork ? [bodyWork] : []), ...clients]));
      if (server?.listening)
        await bounded(
          track(
            new Promise<void>((resolve, reject) =>
              server!.close((error) => (error ? reject(error) : resolve()))
            )
          )
        );
      await bounded(drain());
      check();
      const cleanup = async () => {
        await db(() =>
          prisma.paymentWebhookEvent.deleteMany({ where: { id: { in: ids.events } } })
        );
        const orders = await db(() =>
          prisma.order.findMany({ where: { eventId: { in: eventIds } }, select: { id: true } })
        );
        await db(() =>
          prisma.paymentRefund.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } })
        );
        await db(() =>
          prisma.paymentAttempt.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } })
        );
        await db(() => prisma.ticket.deleteMany({ where: { eventId: { in: eventIds } } }));
        await db(() => prisma.order.deleteMany({ where: { eventId: { in: eventIds } } }));
        await db(() => prisma.ticketType.deleteMany({ where: { eventId: { in: eventIds } } }));
        await db(() => prisma.event.deleteMany({ where: { id: { in: eventIds } } }));
        await db(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }));
        await db(() =>
          prisma.organization.deleteMany({ where: { id: { in: [ids.org, ids.foreign.org] } } })
        );
        expect(
          await db(() => prisma.paymentWebhookEvent.count({ where: { id: { in: ids.events } } }))
        ).toBe(0);
        expect(
          await db(() =>
            prisma.paymentAttempt.count({ where: { orderId: { in: orders.map((o) => o.id) } } })
          )
        ).toBe(0);
        expect(await db(() => prisma.order.count({ where: { eventId: { in: eventIds } } }))).toBe(
          0
        );
        expect(await db(() => prisma.ticket.count({ where: { eventId: { in: eventIds } } }))).toBe(
          0
        );
        expect(
          await db(() => prisma.ticketType.count({ where: { eventId: { in: eventIds } } }))
        ).toBe(0);
        expect(await db(() => prisma.event.count({ where: { id: { in: eventIds } } }))).toBe(0);
        expect(await db(() => prisma.user.count({ where: { id: { in: userIds } } }))).toBe(0);
        expect(
          await db(() =>
            prisma.organization.count({ where: { id: { in: [ids.org, ids.foreign.org] } } })
          )
        ).toBe(0);
        if (receipt) receipt.cleanupVerified = true;
      };
      await bounded(track(cleanup(), false), 30000);
      await bounded(drain());
      check();
      for (const spy of spies.reverse()) spy.mockRestore();
      await bounded(track(redisModule.disconnectRedis()));
      check();
      await bounded(track(prisma.$disconnect()));
      check();
      if (receipt) receipt.lifetimeCleanupVerified = true;
    } catch (error) {
      primary ??= error;
    }
  }
  if (receipt) {
    receipt.passed =
      primary === undefined &&
      !unsafe &&
      backgroundErrors.length === 0 &&
      mockUnexpected === 0 &&
      receipt.cleanupVerified === true &&
      receipt.lifetimeCleanupVerified === true;
    writeReceipt();
  }
  if (primary)
    throw primary instanceof Error
      ? primary
      : new Error('Payment HTTP visibility qualification failed', { cause: primary });
  expect(backgroundErrors).toEqual([]);
  expect(mockUnexpected).toBe(0);
}, 240000);
