// Emulated Chrome -> production-built /scan -> actual mounted HTTP/SQL. No physical/camera claim.
import { randomUUID } from 'crypto';
import { fork, ChildProcess } from 'child_process';
import { Server } from 'http';
import { createServer } from 'net';
import fs from 'fs';
import path from 'path';
import request from 'supertest';

let mockProviderAttempts = 0;
const mockRefuse = () => {
  mockProviderAttempts++;
  throw Error('Scanner browser forbids provider transport');
};
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('../../src/config/logger', () => ({
  logger: { info() {}, error() {}, warn() {}, debug() {}, http() {} },
}));
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: new Proxy({}, { get: () => mockRefuse }),
}));
jest.mock('stripe', () =>
  jest.fn(() => ({
    paymentIntents: { create: mockRefuse, retrieve: mockRefuse },
    refunds: { create: mockRefuse, retrieve: mockRefuse, list: mockRefuse },
    events: { retrieve: mockRefuse },
    webhooks: { constructEvent: mockRefuse },
  }))
);

const gate = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
it('two independent emulated scanner browsers race one paid QR and reject duplicate and revoked use', async () => {
  require('../../../scripts/verification-safety.cjs').validateVerificationTargets(process.env);
  const { observeFunction } = require('../../../scripts/soak-lifetime.cjs') as {
    observeFunction: (
      target: any,
      name: string,
      track: <T>(value: Promise<T>) => Promise<T>
    ) => { mockRestore: () => void };
  };
  const evidence = require('../../../scripts/scanner-browser-guard.cjs') as {
    scope: string;
    flags: string[];
    numbers: string[];
    diagnostic: (value: unknown) => {
      stage: number;
      category: string;
      detail: number;
      reason: number;
      rejected: number;
      entryType: number;
    } | null;
    browserResult: (value: unknown) => Record<string, unknown> | null;
  };
  const ids = {
    org: randomUUID(),
    user: randomUUID(),
    event: randomUUID(),
    type: randomUUID(),
    foreignEvent: randomUUID(),
    foreignType: randomUUID(),
    orders: [randomUUID(), randomUUID(), randomUUID()],
    tickets: [randomUUID(), randomUUID(), randomUUID()],
  };
  const events = [ids.event, ids.foreignEvent],
    pending = new Set<Promise<unknown>>(),
    errors: unknown[] = [];
  let unsafe = false,
    primary: unknown,
    bodyWork: Promise<void> | undefined;
  const check = () => {
    if (unsafe) throw Error('Unjoined scanner lifetime');
  };
  const track = <T>(promise: Promise<T>): Promise<T> => {
    pending.add(promise);
    void promise.then(
      () => pending.delete(promise),
      () => pending.delete(promise)
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
            reject(Error('Scanner lifetime deadline'));
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
  const redisModule = await import('../../src/config/redis');
  const prisma = (await import('../../src/config/prisma')).default;
  let redis: Awaited<ReturnType<typeof redisModule.connectRedis>> | undefined;
  let server: Server | undefined,
    worker: ChildProcess | undefined,
    workerExit: Promise<number | null> | undefined;
  let probe: ReturnType<typeof createServer> | undefined;
  let workerCleanup = false,
    workerResult: Record<string, unknown> | null = null,
    failureStage = 0;
  let receipt: Record<string, unknown> | undefined,
    receiptIdentity: { dev: number; ino: number } | undefined;
  const receiptPath = path.resolve(__dirname, '../../../runtime/task615-scanner-browser.json');
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
        throw Error('Scanner receipt ownership changed');
      fs.writeFileSync(receiptPath, JSON.stringify(receipt) + '\n');
    }
  };
  const requireWorkerCleanup = () => {
    if (worker && !workerCleanup) throw Error('Scanner browser cleanup unproven');
  };
  const releaseRace = gate(),
    raceFinished = gate();
  let raceArrivals = 0,
    raceCompletions = 0;
  let raceLogs: Array<{
    success: boolean;
    scannerId: string;
    ticketId: string | null;
    scanType: string;
  }> = [];
  const body = async () => {
    expect(fs.existsSync(receiptPath)).toBe(false);
    mockProviderAttempts = 0;
    receipt = {
      scope: evidence.scope,
      sourceSha: process.env.TIXMO_SCANNER_SOURCE_SHA || 'local-synthetic',
      runId: process.env.TIXMO_SCANNER_RUN_ID || 'local-synthetic',
      ...Object.fromEntries(evidence.flags.map((key) => [key, false])),
      ...Object.fromEntries(evidence.numbers.map((key) => [key, 0])),
    };
    writeReceipt();
    const { config } = await import('../../src/config/environment');
    expect(config.nodeEnv).toBe('test');
    probe = createServer();
    await bounded(track(new Promise<void>((resolve) => probe!.listen(0, '127.0.0.1', resolve))));
    const frontendPort = (probe.address() as { port: number }).port;
    await bounded(
      track(
        new Promise<void>((resolve, reject) =>
          probe!.close((error) => (error ? reject(error) : resolve()))
        )
      )
    );
    probe = undefined;
    const clientOrigin = `http://127.0.0.1:${frontendPort}`;
    const clientUrl = jest.replaceProperty(config, 'clientUrl', clientOrigin);
    spies.push({ mockRestore: () => clientUrl.restore() });
    redis = await db(() => redisModule.connectRedis());
    for (const name of ['sendCommand', 'eval', 'zRem'])
      spies.push(observeFunction(redis, name, track));
    const asyncModule = await import('../../src/utils/catchAsync');
    const originalCatch = asyncModule.catchAsync;
    spies.push(
      jest
        .spyOn(asyncModule, 'catchAsync')
        .mockImplementation((fn) => originalCatch((...args) => track(Promise.resolve(fn(...args)))))
    );
    const auth = await import('../../src/middleware/auth'),
      scannerAuth = await import('../../src/middleware/scannerAuth'),
      waiting = await import('../../src/middleware/waitingRoom'),
      limiter = await import('../../src/middleware/rateLimiter'),
      controller = await import('../../src/api/scanners/controller');
    for (const [target, names] of [
      [auth, ['authenticate', 'optionalAuthenticate']],
      [scannerAuth, ['authenticateScanner', 'authenticateAdmissionScanner']],
      [waiting, ['waitingRoom']],
      [
        limiter,
        [
          'apiReadRateLimiter',
          'apiWriteRateLimiter',
          'authRateLimiter',
          'authAccountRateLimiter',
          'checkoutActorRateLimiter',
          'checkoutIpRateLimiter',
          'scannerAdmissionRateLimiter',
          'scannerAuthFailureLimiter',
        ],
      ],
      [controller, ['registerScanner', 'authenticateScanner', 'scanTicket', 'deleteScanner']],
    ] as Array<[any, string[]]>)
      for (const name of names) spies.push(observeFunction(target, name, track));
    const validation = await import('../../src/middleware/validate'),
      realValidate = validation.validate;
    spies.push(
      jest.spyOn(validation, 'validate').mockImplementation((schema) => {
        const handler = realValidate(schema);
        return (...args: Parameters<typeof handler>) => track(Promise.resolve(handler(...args)));
      })
    );
    const app = (await import('../../src/app')).default;
    server = await bounded(
      track(
        new Promise<Server>((resolve, reject) => {
          const active = app.listen(0, '127.0.0.1', () => resolve(active));
          active.once('error', reject);
        })
      )
    );
    const apiOrigin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const { scannerService } = await import('../../src/api/scanners/service');
    const { ACTIVE_REQUESTS_KEY } = await import('../../src/middleware/waitingRoom');
    const leaseBaseline = await db(() => redis!.zCard(ACTIVE_REQUESTS_KEY));
    await db(() =>
      prisma.organization.create({
        data: { id: ids.org, name: 'Synthetic scanner', slug: ids.org, type: 'PROMOTER' },
      })
    );
    await db(() =>
      prisma.user.create({
        data: {
          id: ids.user,
          organizationId: ids.org,
          email: ids.user + '@synthetic.test',
          passwordHash: 'synthetic',
          firstName: 'Synthetic',
          lastName: 'Scanner',
          role: 'OWNER',
          emailVerified: true,
        },
      })
    );
    for (const [event, type, sold] of [
      [ids.event, ids.type, 2],
      [ids.foreignEvent, ids.foreignType, 1],
    ] as const) {
      await db(() =>
        prisma.event.create({
          data: {
            id: event,
            organizationId: ids.org,
            name: event,
            slug: event,
            tags: [],
            status: 'PUBLISHED',
            startDatetime: new Date(Date.now() + 86400000),
          },
        })
      );
      await db(() =>
        prisma.ticketType.create({
          data: {
            id: type,
            eventId: event,
            name: 'GA',
            price: 10,
            quantityTotal: sold,
            quantityAvailable: 0,
            quantitySold: sold,
          },
        })
      );
    }
    const barcodes = ids.tickets.map(() => `TIX-${randomUUID().replaceAll('-', '').slice(0, 24)}`);
    for (let i = 0; i < 3; i++) {
      const event = i === 2 ? ids.foreignEvent : ids.event,
        type = i === 2 ? ids.foreignType : ids.type;
      await db(() =>
        prisma.order.create({
          data: {
            id: ids.orders[i],
            orderNumber: ids.orders[i],
            userId: ids.user,
            eventId: event,
            status: 'PAID',
            paymentStatus: 'SUCCEEDED',
            totalAmount: 10,
            currency: 'cad',
            receiptStatus: 'SENT',
            receiptSentAt: new Date(),
          },
        })
      );
      await db(() =>
        prisma.ticket.create({
          data: {
            id: ids.tickets[i],
            orderId: ids.orders[i],
            userId: ids.user,
            eventId: event,
            ticketTypeId: type,
            barcode: barcodes[i],
            status: 'VALID',
            inventoryState: 'SOLD',
            pricePaid: 10,
          },
        })
      );
    }
    const financial = async () => ({
      orders: await db(() =>
        prisma.order.findMany({ where: { id: { in: ids.orders } }, orderBy: { id: 'asc' } })
      ),
      stock: await db(() =>
        prisma.ticketType.findMany({
          where: { id: { in: [ids.type, ids.foreignType] } },
          orderBy: { id: 'asc' },
        })
      ),
      attempts: await db(() =>
        prisma.paymentAttempt.findMany({ where: { orderId: { in: ids.orders } } })
      ),
      refunds: await db(() =>
        prisma.paymentRefund.findMany({ where: { orderId: { in: ids.orders } } })
      ),
    });
    const beforeFinancial = await financial();
    const beforeRace = await db(() =>
      prisma.ticket.findUniqueOrThrow({ where: { id: ids.tickets[0] } })
    );
    const beforeFresh = await db(() =>
      prisma.ticket.findUniqueOrThrow({ where: { id: ids.tickets[1] } })
    );
    const foreign = async () => ({
      event: await db(() => prisma.event.findUniqueOrThrow({ where: { id: ids.foreignEvent } })),
      ticket: await db(() => prisma.ticket.findUniqueOrThrow({ where: { id: ids.tickets[2] } })),
      logs: await db(() => prisma.scanLog.findMany({ where: { ticketId: ids.tickets[2] } })),
    });
    const beforeForeign = await foreign();
    const { generateAccessToken } = await import('../../src/utils/jwt');
    const token = generateAccessToken({
      userId: ids.user,
      email: ids.user + '@synthetic.test',
      role: 'OWNER',
      organizationId: ids.org,
      sessionVersion: 0,
      emailVerified: true,
    });
    const scanners: Array<{ id: string; apiKey: string }> = [];
    for (let i = 0; i < 2; i++) {
      const response = await bounded(
        track(
          request(apiOrigin)
            .post('/api/v1/scanners/register')
            .set('Authorization', 'Bearer ' + token)
            .send({ name: 'Synthetic gate ' + i, organizationId: ids.org, eventId: ids.event })
            .then((value) => value)
        )
      );
      expect(response.status).toBe(201);
      scanners.push(response.body.data as { id: string; apiKey: string });
    }
    const realScan = scannerService.scanTicket.bind(scannerService);
    spies.push(
      jest.spyOn(scannerService, 'scanTicket').mockImplementation((data) =>
        track(
          (async () => {
            check();
            const inRace = raceArrivals < 2;
            if (inRace) {
              raceArrivals++;
              if (raceArrivals === 2) releaseRace.resolve();
              await releaseRace.promise;
              check();
            }
            const value = await realScan(data);
            if (inRace) {
              raceCompletions++;
              if (raceCompletions === 2) {
                raceLogs = await db(() =>
                  prisma.scanLog.findMany({ where: { ticketId: ids.tickets[0] } })
                );
                raceFinished.resolve();
              }
              await raceFinished.promise;
            }
            return value;
          })()
        )
      )
    );
    const chrome = process.env.TIXMO_BROWSER_PATH;
    expect(chrome).toMatch(/^\/[a-zA-Z0-9_./-]+$/);
    worker = fork(path.resolve(__dirname, '../../../scripts/browser/scanner-sessions.mjs'), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: 'production',
        TIXMO_ALLOW_DESTRUCTIVE_TESTS: '1',
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        TIXMO_BROWSER_PATH: chrome,
        TIXMO_SCANNER_API: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
        TIXMO_SCANNER_PORT: String(frontendPort),
        TIXMO_SCANNER_FIXTURE: JSON.stringify({
          keys: scanners.map((row) => row.apiKey),
          qr: `TICKET:${ids.tickets[0]}:${barcodes[0]}:${ids.event}`,
          freshQr: `TICKET:${ids.tickets[1]}:${barcodes[1]}:${ids.event}`,
        }),
      },
    });
    workerExit = new Promise((resolve, reject) => {
      worker!.once('close', resolve);
      worker!.once('error', reject);
    });
    void workerExit.catch(() => {});
    let revocations = 0;
    worker.on('message', (message: unknown) => {
      const value = message as Record<string, unknown>;
      const diagnostic = evidence.diagnostic(value?.diagnostic);
      if (diagnostic && diagnostic.category !== 'progress' && !failureStage) {
        failureStage = diagnostic.stage;
        if (receipt) {
          receipt.diagnosticStage = failureStage;
          receipt.diagnosticDetail = diagnostic.detail;
          receipt.diagnosticReason = diagnostic.reason;
          receipt.diagnosticEntryType = diagnostic.entryType;
          receipt.unexpectedBrowserRequests = diagnostic.rejected;
        }
      }
      if (value?.revoke === true) {
        const work = (async () => {
          if (++revocations !== 1) throw Error('Duplicate revocation request');
          const response = await request(apiOrigin)
            .delete('/api/v1/scanners/' + scanners[1].id)
            .set('Authorization', 'Bearer ' + token);
          expect(response.status).toBe(204);
          await new Promise<void>((resolve, reject) =>
            worker!.send({ revoked: true }, (error) =>
              error ? reject(Error('Scanner IPC failed')) : resolve()
            )
          );
        })();
        void track(work);
        void work.catch((error) => errors.push(error));
      }
      if (value?.cleanup === true) workerCleanup = true;
      const projected = evidence.browserResult(value);
      if (projected) workerResult = projected;
    });
    const code = await bounded(workerExit, 180000);
    expect(failureStage).toBe(0);
    expect(code).toBe(0);
    expect(workerCleanup).toBe(true);
    expect(workerResult).not.toBeNull();
    await bounded(drain());
    expect(raceArrivals).toBe(2);
    expect(raceCompletions).toBe(2);
    expect(raceLogs).toHaveLength(2);
    expect(raceLogs.filter((row) => row.success)).toHaveLength(1);
    expect(new Set(raceLogs.map((row) => row.scannerId))).toEqual(
      new Set(scanners.map((row) => row.id))
    );
    expect(
      raceLogs.every((row) => row.scanType === 'ENTRY' && row.ticketId === ids.tickets[0])
    ).toBe(true);
    const allLogs = await db(() =>
      prisma.scanLog.findMany({ where: { scannerId: { in: scanners.map((row) => row.id) } } })
    );
    expect(allLogs).toHaveLength(4);
    expect(allLogs.filter((row) => row.success)).toHaveLength(1);
    expect(allLogs.filter((row) => row.failureReason === 'REVOKED')).toHaveLength(1);
    const used = await db(() => prisma.ticket.findUniqueOrThrow({ where: { id: ids.tickets[0] } }));
    expect(used).toEqual({
      ...beforeRace,
      status: 'USED',
      checkedInBy: raceLogs.find((row) => row.success)!.scannerId,
      checkedInAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(used.checkedInBy).toBe(raceLogs.find((row) => row.success)!.scannerId);
    expect(used.checkedInAt).not.toBeNull();
    expect(
      await db(() => prisma.ticket.findUniqueOrThrow({ where: { id: ids.tickets[1] } }))
    ).toEqual(beforeFresh);
    expect(await financial()).toEqual(beforeFinancial);
    expect(await foreign()).toEqual(beforeForeign);
    expect(
      (await db(() => prisma.scanner.findUniqueOrThrow({ where: { id: scanners[1].id } }))).status
    ).toBe('REVOKED');
    expect(await db(() => redis!.zCard(ACTIVE_REQUESTS_KEY))).toBe(leaseBaseline);
    expect(mockProviderAttempts).toBe(0);
    expect(errors).toEqual([]);
    receipt = {
      scope: evidence.scope,
      sourceSha: process.env.TIXMO_SCANNER_SOURCE_SHA || 'local-synthetic',
      runId: process.env.TIXMO_SCANNER_RUN_ID || 'local-synthetic',
      passed: false,
      ...workerResult,
      diagnosticStage: failureStage,
      diagnosticDetail: 0,
      diagnosticReason: 0,
      diagnosticEntryType: 0,
      unexpectedBrowserRequests: 0,
      browserProcesses: 2,
      raceArrivals,
      raceAdmissions: 1,
      raceRejections: 1,
      entrySuccesses: 1,
      raceAttempts: 2,
      allAttempts: 3,
      providerAttempts: mockProviderAttempts,
      financialUnchanged: true,
      foreignUnchanged: true,
      cleanupVerified: false,
      lifetimeCleanupVerified: false,
    };
    delete receipt.ok;
    writeReceipt();
  };
  try {
    bodyWork = body();
    await bounded(bodyWork, 210000);
  } catch (error) {
    primary = error;
  } finally {
    releaseRace.resolve();
    raceFinished.resolve();
    if (worker && worker.exitCode === null && worker.signalCode === null) worker.kill('SIGTERM');
    try {
      if (workerExit) await bounded(workerExit, 20000);
      requireWorkerCleanup();
      await bounded(Promise.allSettled(bodyWork ? [bodyWork] : []));
      if (server?.listening)
        await bounded(
          track(
            new Promise<void>((resolve, reject) =>
              server!.close((error) => (error ? reject(error) : resolve()))
            )
          )
        );
      if (probe?.listening)
        await bounded(
          track(
            new Promise<void>((resolve, reject) =>
              probe!.close((error) => (error ? reject(error) : resolve()))
            )
          )
        );
      await bounded(drain());
      check();
      const cleanup = async () => {
        await db(() =>
          prisma.scanLog.deleteMany({ where: { scanner: { organizationId: ids.org } } })
        );
        await db(() => prisma.scanner.deleteMany({ where: { organizationId: ids.org } }));
        await db(() => prisma.ticket.deleteMany({ where: { id: { in: ids.tickets } } }));
        await db(() => prisma.order.deleteMany({ where: { id: { in: ids.orders } } }));
        await db(() =>
          prisma.ticketType.deleteMany({ where: { id: { in: [ids.type, ids.foreignType] } } })
        );
        await db(() => prisma.event.deleteMany({ where: { id: { in: events } } }));
        await db(() => prisma.user.deleteMany({ where: { id: ids.user } }));
        await db(() => prisma.organization.deleteMany({ where: { id: ids.org } }));
        expect(
          await db(() => prisma.scanLog.count({ where: { scanner: { organizationId: ids.org } } }))
        ).toBe(0);
        expect(await db(() => prisma.scanner.count({ where: { organizationId: ids.org } }))).toBe(
          0
        );
        expect(await db(() => prisma.ticket.count({ where: { id: { in: ids.tickets } } }))).toBe(0);
        expect(await db(() => prisma.order.count({ where: { id: { in: ids.orders } } }))).toBe(0);
        expect(await db(() => prisma.organization.count({ where: { id: ids.org } }))).toBe(0);
        expect(await db(() => prisma.user.count({ where: { id: ids.user } }))).toBe(0);
        expect(await db(() => prisma.event.count({ where: { id: { in: events } } }))).toBe(0);
        expect(
          await db(() =>
            prisma.ticketType.count({ where: { id: { in: [ids.type, ids.foreignType] } } })
          )
        ).toBe(0);
        if (receipt) receipt.cleanupVerified = true;
      };
      await bounded(track(cleanup()), 30000);
      await bounded(drain());
      check();
      await bounded(track(redisModule.disconnectRedis()));
      check();
      await bounded(track(prisma.$disconnect()));
      check();
      for (const spy of spies.reverse()) spy.mockRestore();
      if (receipt) receipt.lifetimeCleanupVerified = true;
    } catch (error) {
      primary ??= error;
    }
  }
  if (receipt) {
    receipt.diagnosticStage = failureStage;
    receipt.raceArrivals = raceArrivals;
    receipt.providerAttempts = mockProviderAttempts;
    receipt.passed =
      primary === undefined &&
      !unsafe &&
      errors.length === 0 &&
      mockProviderAttempts === 0 &&
      receipt.cleanupVerified === true &&
      receipt.lifetimeCleanupVerified === true;
    writeReceipt();
  }
  if (primary)
    throw primary instanceof Error
      ? primary
      : new Error('Scanner qualification failed', { cause: primary });
  expect(errors).toEqual([]);
  expect(mockProviderAttempts).toBe(0);
}, 250000);
