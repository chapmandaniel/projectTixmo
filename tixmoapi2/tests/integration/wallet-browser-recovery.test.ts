// Real app/auth/JWT/ownership/SQL/Redis; only external provider/email transport synthetic.
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.unmock('../../src/utils/notificationService');
jest.mock('stripe', () =>
  jest.fn(() => {
    const refused = jest.fn(() => {
      throw new Error('Wallet recovery forbids provider transport');
    });
    return {
      paymentIntents: { create: refused, retrieve: refused },
      refunds: { create: refused, retrieve: refused, list: refused },
      events: { retrieve: refused },
      webhooks: { constructEvent: refused },
      refused,
    };
  })
);
jest.mock('../../src/config/email', () => ({
  emailFrom: { name: 'Synthetic capture', address: 'sender@synthetic.test' },
  transporter: { sendMail: jest.fn(() => Promise.resolve({ messageId: 'inert-capture' })) },
}));
import { randomUUID } from 'crypto';
import { fork, ChildProcess, execFileSync } from 'child_process';
import { Server } from 'http';
import { createServer } from 'net';
import path from 'path';
import request from 'supertest';
import Stripe from 'stripe';
import { transporter } from '../../src/config/email';

let lifetime: Promise<void> | undefined;
let unsafe = false;
afterAll(async () => {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      Promise.allSettled(lifetime ? [lifetime] : []),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          unsafe = true;
          reject(new Error('Wallet lifetime unjoined; preserve context'));
        }, 8000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}, 10000);
it('current browser reopens owned wallet and confirmed return, refreshes elapsed JWT, denies foreign buyer and captures only permitted receipt', () => {
  lifetime = qualifyWallet();
  return lifetime;
}, 160000);
async function qualifyWallet() {
  require('../../../scripts/verification-safety.cjs').validateVerificationTargets(process.env);
  const ids = {
    a: randomUUID(),
    b: randomUUID(),
    org: randomUUID(),
    event: randomUUID(),
    type: randomUUID(),
    order: randomUUID(),
    unpaid: randomUUID(),
    ticket: randomUUID(),
  };
  const pending = new Set<Promise<unknown>>(),
    errors: unknown[] = [];
  const spies: Array<{ mockRestore: () => void }> = [];
  const track = <T>(promise: Promise<T>, report = true) => {
    pending.add(promise);
    void promise.then(
      () => pending.delete(promise),
      (error) => {
        pending.delete(promise);
        if (report) errors.push(error);
      }
    );
    return promise;
  };
  const bounded = async <T>(promise: Promise<T>, ms = 8000): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Wallet work remains unresolved; preserve fixtures')),
            ms
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const drain = async () => {
    while (pending.size) await Promise.allSettled([...pending]);
  };
  const redisModule = await import('../../src/config/redis');
  const prisma = (await import('../../src/config/prisma')).default;
  let server: Server | undefined,
    browser: ChildProcess | undefined,
    browserExit: Promise<number | null> | undefined;
  let probe: ReturnType<typeof createServer> | undefined;
  const requireSafeCleanup = () => {
    if (unsafe || (browser && !workerCleanup))
      throw new Error('Browser lifetime cleanup unproven; preserve fixtures');
  };
  let primary: unknown,
    workerCleanup = false;
  try {
    const redis = await redisModule.connectRedis();
    expect(redis.isReady).toBe(true);
    for (const name of ['sendCommand', 'eval', 'zRem'] as const) {
      const target = redis as any,
        original = target[name].bind(redis);
      spies.push(
        jest
          .spyOn(target, name)
          .mockImplementation((...args: unknown[]) => track(original(...args)))
      );
    }
    const asyncModule = await import('../../src/utils/catchAsync');
    spies.push(
      jest.spyOn(asyncModule, 'catchAsync').mockImplementation((fn) => (req, res, next) => {
        void track(Promise.resolve(fn(req, res, next)), false).catch(next);
      })
    );
    const auth = await import('../../src/middleware/auth'),
      waiting = await import('../../src/middleware/waitingRoom'),
      limiter = await import('../../src/middleware/rateLimiter');
    for (const [module, names] of [
      [auth, ['authenticate', 'optionalAuthenticate']],
      [waiting, ['waitingRoom']],
      [limiter, ['apiReadRateLimiter', 'apiWriteRateLimiter', 'authRateLimiter']],
    ] as Array<[any, string[]]>) {
      for (const name of names) {
        const original = module[name];
        spies.push(
          jest
            .spyOn(module, name)
            .mockImplementation((...args: any[]) => track(Promise.resolve(original(...args))))
        );
      }
    }
    const validation = await import('../../src/middleware/validate'),
      realValidate = validation.validate;
    spies.push(
      jest.spyOn(validation, 'validate').mockImplementation((schema) => {
        const handler = realValidate(schema);
        return (...args: Parameters<typeof handler>) => track(Promise.resolve(handler(...args)));
      })
    );
    const { config } = await import('../../src/config/environment');
    expect(config.nodeEnv).toBe('test');
    for (const name of [
      'rateLimitReadMax',
      'rateLimitWriteMax',
      'waitingRoomMaxConcurrentRequests',
    ] as const) {
      const replacement = jest.replaceProperty(config, name, 1000);
      spies.push({ mockRestore: () => replacement.restore() });
    }
    for (const [name, value] of [
      ['jwtExpiresIn', '10s'],
      ['jwtRefreshExpiresIn', '120s'],
    ] as const) {
      const replacement = jest.replaceProperty(config, name, value);
      spies.push({ mockRestore: () => replacement.restore() });
    }
    probe = createServer();
    await track(new Promise<void>((resolve) => probe!.listen(0, '127.0.0.1', resolve)));
    const frontendPort = (probe.address() as any).port;
    await track(
      new Promise<void>((resolve, reject) =>
        probe!.close((error) => (error ? reject(error) : resolve()))
      )
    );
    probe = undefined;
    const clientUrl = `http://127.0.0.1:${frontendPort}`;
    const replacement = jest.replaceProperty(config, 'clientUrl', clientUrl);
    spies.push({ mockRestore: () => replacement.restore() });
    const app = (await import('../../src/app')).default;
    server = await track(
      new Promise<Server>((resolve) => {
        const owned = app.listen(0, '127.0.0.1', () => resolve(owned));
      })
    );
    const { hashPassword } = await import('../../src/utils/password');
    const password = 'Synthetic-Wallet-Only!',
      passwordHash = await hashPassword(password);
    for (const [name, id] of [
      ['a', ids.a],
      ['b', ids.b],
    ])
      await prisma.user.create({
        data: {
          id,
          email: `${id}@synthetic.test`,
          firstName: name === 'a' ? '<script>A&' : 'B',
          lastName: 'Fixture',
          passwordHash,
          emailVerified: true,
        },
      });
    await prisma.organization.create({
      data: { id: ids.org, name: 'Synthetic wallet', slug: ids.org, type: 'PROMOTER' },
    });
    await prisma.event.create({
      data: {
        id: ids.event,
        organizationId: ids.org,
        name: '<img src=x onerror=bad>& event',
        slug: `wallet-${ids.event}`,
        tags: [],
        status: 'ON_SALE',
        startDatetime: new Date(Date.now() + 86400000),
      },
    });
    await prisma.ticketType.create({
      data: {
        id: ids.type,
        eventId: ids.event,
        name: 'GA',
        price: 10,
        quantityTotal: 1,
        quantityAvailable: 0,
        quantitySold: 1,
      },
    });
    const order = await prisma.order.create({
      data: {
        id: ids.order,
        orderNumber: `WALLET-${ids.order}`,
        userId: ids.a,
        eventId: ids.event,
        status: 'PAID',
        paymentStatus: 'SUCCEEDED',
        totalAmount: 10,
        currency: 'cad',
      },
    });
    await prisma.order.create({
      data: {
        id: ids.unpaid,
        orderNumber: `UNPAID-${ids.unpaid}`,
        userId: ids.a,
        eventId: ids.event,
        totalAmount: 0,
        currency: 'cad',
      },
    });
    await prisma.ticket.create({
      data: {
        id: ids.ticket,
        orderId: ids.order,
        eventId: ids.event,
        ticketTypeId: ids.type,
        userId: ids.a,
        barcode: ids.ticket,
        pricePaid: 10,
        inventoryState: 'SOLD',
      },
    });
    const snapshot = async () => ({
      orders: await prisma.order.findMany({
        where: { id: { in: [ids.order, ids.unpaid] } },
        orderBy: { id: 'asc' },
      }),
      tickets: await prisma.ticket.findMany({
        where: { eventId: ids.event },
        orderBy: { id: 'asc' },
      }),
      stock: await prisma.ticketType.findUniqueOrThrow({ where: { id: ids.type } }),
      attempts: await prisma.paymentAttempt.findMany({
        where: { orderId: { in: [ids.order, ids.unpaid] } },
      }),
      refunds: await prisma.paymentRefund.findMany({
        where: { orderId: { in: [ids.order, ids.unpaid] } },
      }),
    });
    // Real QR reads cache QR metadata; establish that legitimate write before the immutable baseline.
    const { ticketService } = await import('../../src/api/tickets/service');
    expect(await ticketService.getTicketQRCode(ids.ticket, ids.a)).toMatch(
      /^data:image\/png;base64,/
    );
    const before = await snapshot();
    const chrome =
      process.env.TIXMO_BROWSER_PATH ||
      execFileSync('which', ['google-chrome'], { encoding: 'utf8' }).trim();
    expect(path.isAbsolute(chrome)).toBe(true);
    (transporter.sendMail as jest.Mock).mockImplementation(
      (mail: { subject: string; to: string; text: string }) => {
        if (mail.subject !== 'Reset your Tixmo buyer password')
          return Promise.resolve({ messageId: 'inert-capture' });
        expect(mail.to).toBe(`${ids.a}@synthetic.test`);
        const captured = mail.text.match(
          /http:\/\/127\.0\.0\.1:[0-9]+\/reset-password#token=[a-f0-9]{64}/
        )?.[0];
        expect(Boolean(captured)).toBe(true);
        return new Promise((resolve, reject) =>
          browser!.send({ resetLink: captured }, (error) =>
            error
              ? reject(new Error('Owned reset-link IPC failed'))
              : resolve({ messageId: 'inert-capture' })
          )
        );
      }
    );
    browser = fork(path.resolve(__dirname, '../../../scripts/browser/wallet-continuity.mjs'), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        // Frontend build only; the mounted API remains in its own test process.
        NODE_ENV: 'production',
        TIXMO_ALLOW_DESTRUCTIVE_TESTS: '1',
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        TIXMO_BROWSER_PATH: chrome,
        TIXMO_WALLET_API: `http://127.0.0.1:${(server.address() as any).port}`,
        TIXMO_WALLET_PORT: String(frontendPort),
        TIXMO_WALLET_FIXTURE: JSON.stringify({
          a: `${ids.a}@synthetic.test`,
          b: `${ids.b}@synthetic.test`,
          password,
          newPassword: 'Synthetic-Recovered2!',
          orderId: ids.order,
          ticketId: ids.ticket,
          orderNumber: order.orderNumber,
          slug: `wallet-${ids.event}`,
        }),
      },
    });
    browserExit = new Promise((resolve, reject) => {
      browser!.once('close', resolve);
      browser!.once('error', reject);
    });
    let result: any;
    browser.on('message', (message: any) => {
      if (message.ok === true) result = message;
      if (
        message.cleanup === true &&
        message.profileRemoved === true &&
        message.browserStopped === true &&
        message.frontendStopped === true
      )
        workerCleanup = true;
    });
    expect(await bounded(browserExit, 120000)).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      browserProcesses: 3,
      reopenedOwner: true,
      nativeExpiry: true,
      foreignDenied: true,
      ownerReauthenticated: true,
      lostPasswordRecovered: true,
      fragmentCleared: true,
      earlyFragmentCapture: true,
      resetDocumentCsp: true,
      newPasswordSignedIn: true,
    });
    expect(workerCleanup).toBe(true);
    expect(result.pids).toHaveLength(3);
    expect(new Set(result.pids).size).toBe(3);
    expect(result.cleanupProofs).toHaveLength(3);
    expect(result.cleanupProofs.map((proof: { pid: number }) => proof.pid)).toEqual(result.pids);
    expect(
      result.cleanupProofs.every(
        (proof: { groupStopped: boolean; debugListenerClosed: boolean }) =>
          proof.groupStopped && proof.debugListenerClosed
      )
    ).toBe(true);
    expect(result.pids.every((pid: number) => Number.isInteger(pid) && pid > 0)).toBe(true);
    expect(result.issued.exp - result.issued.iat).toBe(10);
    expect(result.renewed.iat).toBeGreaterThan(result.issued.iat);
    expect(result.elapsed.wallStart).toBeLessThan(result.issued.exp * 1000);
    expect(result.elapsed.wallEnd).toBeGreaterThan(result.issued.exp * 1000);
    expect(Math.abs(result.elapsed.wallMs - result.elapsed.monotonicMs)).toBeLessThan(1000);
    expect(result.elapsed.wallMs).toBeGreaterThan(0);
    expect(result.elapsed.monotonicMs).toBeGreaterThan(0);
    await bounded(drain());
    expect(await snapshot()).toEqual(before);
    const recoveryMailCount = (transporter.sendMail as jest.Mock).mock.calls.length;
    expect(recoveryMailCount).toBe(2);
    expect(
      (transporter.sendMail as jest.Mock).mock.calls.filter(
        ([mail]) => mail.subject === 'Reset your Tixmo buyer password'
      ).length
    ).toBe(1);
    expect(
      (transporter.sendMail as jest.Mock).mock.calls.filter(
        ([mail]) => mail.subject === 'Your Tixmo buyer password changed'
      ).length
    ).toBe(1);
    const login = async (id: string) => {
      const response = await request(server!)
        .post('/api/v1/auth/login')
        .send({
          email: `${id}@synthetic.test`,
          password: id === ids.a ? 'Synthetic-Recovered2!' : password,
        });
      expect(response.status).toBe(200);
      return response.body.data.accessToken as string;
    };
    const a = await login(ids.a),
      b = await login(ids.b);
    const receipt = (id: string, token: string) =>
      request(server!).post(`/api/v1/orders/${id}/receipt`).set('Authorization', `Bearer ${token}`);
    expect((await receipt(ids.order, b)).status).toBe(404);
    expect(transporter.sendMail).toHaveBeenCalledTimes(recoveryMailCount);
    expect((await receipt(ids.unpaid, a)).status).toBe(400);
    expect(transporter.sendMail).toHaveBeenCalledTimes(recoveryMailCount);
    expect((await receipt(ids.order, a)).status).toBe(200);
    expect(transporter.sendMail).toHaveBeenCalledTimes(recoveryMailCount + 1);
    const mail = (transporter.sendMail as jest.Mock).mock.calls.at(-1)![0];
    expect(mail.to).toBe(`${ids.a}@synthetic.test`);
    expect(mail.html).toContain(`href="${clientUrl}/wallet"`);
    expect(mail.text).toContain(`${clientUrl}/wallet`);
    expect(mail.html).toContain('&lt;script&gt;A&amp;');
    expect(mail.html).toContain('&lt;img src=x onerror=bad&gt;&amp; event');
    expect(mail.html).not.toContain('<script>A&');
    expect(mail.html).not.toContain('<img src=x');
    const after = await snapshot();
    expect(after.orders.find((row) => row.id === ids.order)).toMatchObject({
      receiptStatus: 'SENT',
    });
    const financial = (value: typeof after) => ({
      ...value,
      orders: value.orders.map(
        ({
          receiptStatus: _status,
          receiptSentAt: _sent,
          receiptStartedAt: _started,
          receiptLeaseToken: _lease,
          updatedAt: _updated,
          ...row
        }) => row
      ),
    });
    expect(financial(after)).toEqual(financial(before));
    await bounded(drain());
    expect(errors).toEqual([]);
    for (const result of (Stripe as unknown as jest.Mock).mock.results)
      expect(result.value.refused).not.toHaveBeenCalled();
  } catch (error) {
    primary = error;
  } finally {
    try {
      if (browser && browser.exitCode === null && browser.signalCode === null) {
        browser.kill('SIGTERM');
        await bounded(browserExit!);
      }
      if (probe)
        await bounded(
          new Promise<void>((resolve, reject) =>
            probe!.close((error) => (error ? reject(error) : resolve()))
          )
        );
      if (server) {
        server.closeIdleConnections();
        await bounded(
          new Promise<void>((resolve, reject) =>
            server!.close((error) => (error ? reject(error) : resolve()))
          )
        );
      }
      await bounded(drain());
      requireSafeCleanup();
      const cleanup = track(
        (async () => {
          requireSafeCleanup();
          await prisma.buyerPasswordReset.deleteMany({ where: { userId: { in: [ids.a, ids.b] } } });
          requireSafeCleanup();
          await prisma.ticket.deleteMany({ where: { eventId: ids.event } });
          requireSafeCleanup();
          await prisma.order.deleteMany({ where: { id: { in: [ids.order, ids.unpaid] } } });
          requireSafeCleanup();
          await prisma.ticketType.deleteMany({ where: { id: ids.type } });
          requireSafeCleanup();
          await prisma.event.deleteMany({ where: { id: ids.event } });
          requireSafeCleanup();
          await prisma.organization.deleteMany({ where: { id: ids.org } });
          requireSafeCleanup();
          await prisma.user.deleteMany({ where: { id: { in: [ids.a, ids.b] } } });
        })(),
        false
      );
      await bounded(cleanup);
      await bounded(drain());
      requireSafeCleanup();
      await bounded(track(redisModule.disconnectRedis(), false));
      requireSafeCleanup();
      await bounded(track(prisma.$disconnect(), false));
      requireSafeCleanup();
      for (const spy of spies.reverse()) spy.mockRestore();
    } catch (error) {
      unsafe = true;
      primary ??= error;
    }
  }
  if (primary instanceof Error) throw primary;
  if (primary !== undefined)
    throw new Error('Wallet browser qualification failed', { cause: primary });
}
