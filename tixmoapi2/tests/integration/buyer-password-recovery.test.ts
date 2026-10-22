// Collected mounted HTTP + real SQL. External mail capture only; no provider transport.
jest.unmock('../../src/utils/notificationService');
jest.mock('../../src/config/email', () => ({
  emailFrom: { name: 'Synthetic', address: 'sender@synthetic.test' },
  transporter: { sendMail: jest.fn(() => Promise.resolve({ messageId: 'synthetic-capture' })) },
}));
jest.mock('stripe', () =>
  jest.fn(
    () =>
      new Proxy(
        {},
        {
          get: () => {
            throw new Error('Recovery forbids provider transport');
          },
        }
      )
  )
);
import request from 'supertest';
import { randomUUID, createHash } from 'crypto';
import prisma from '../../src/config/prisma';
import { transporter } from '../../src/config/email';
import { hashPassword, comparePassword } from '../../src/utils/password';
import { config } from '../../src/config/environment';

let work: Promise<void> | undefined,
  unsafe = false;
const pending = new Set<Promise<unknown>>();
const track = <T>(promise: Promise<T>) => {
  pending.add(promise);
  void promise.then(
    () => pending.delete(promise),
    () => pending.delete(promise)
  );
  return promise;
};
const bounded = async <T>(promise: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          unsafe = true;
          reject(new Error('Unjoined buyer recovery work; preserve fixtures'));
        }, 8000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
const drain = async () => {
  while (pending.size) await Promise.allSettled([...pending]);
};
let app: any,
  ids: {
    a: string;
    b: string;
    org: string;
    event: string;
    type: string;
    order: string;
    foreignOrder: string;
    ticket: string;
    foreignTicket: string;
  };
const spies: Array<{ mockRestore: () => void }> = [];
const password = 'Synthetic-Old1!',
  nextPassword = 'Synthetic-New2!';
const testCase = (name: string, body: () => Promise<void>) =>
  it(
    name,
    () => {
      work = body();
      return work;
    },
    30000
  );
const safe = () => {
  if (unsafe) throw new Error('Preserve buyer recovery context');
};
beforeAll(async () => {
  const asyncModule = await import('../../src/utils/catchAsync');
  spies.push(
    jest.spyOn(asyncModule, 'catchAsync').mockImplementation((fn) => (req, res, next) => {
      void track(Promise.resolve(fn(req, res, next))).catch(next);
    })
  );
  const replacement = jest.replaceProperty(config, 'clientUrl', 'https://buyer.synthetic.test');
  spies.push({ mockRestore: () => replacement.restore() });
  app = (await import('../../src/app')).default;
});
beforeEach(() => {
  work = (async () => {
    safe();
    jest.clearAllMocks();
    (transporter.sendMail as jest.Mock).mockResolvedValue({ messageId: 'synthetic-capture' });
    ids = {
      a: randomUUID(),
      b: randomUUID(),
      org: randomUUID(),
      event: randomUUID(),
      type: randomUUID(),
      order: randomUUID(),
      foreignOrder: randomUUID(),
      ticket: randomUUID(),
      foreignTicket: randomUUID(),
    };
    const passwordHash = await hashPassword(password);
    for (const id of [ids.a, ids.b]) {
      safe();
      await prisma.user.create({
        data: {
          id,
          email: `${id}@synthetic.test`,
          firstName: 'Synthetic',
          lastName: 'Buyer',
          passwordHash,
          emailVerified: true,
        },
      });
    }
    safe();
    await prisma.organization.create({
      data: { id: ids.org, name: 'Synthetic recovery', slug: ids.org, type: 'PROMOTER' },
    });
    safe();
    await prisma.event.create({
      data: {
        id: ids.event,
        organizationId: ids.org,
        name: 'Synthetic recovery',
        slug: ids.event,
        tags: [],
        status: 'ON_SALE',
        startDatetime: new Date(Date.now() + 86400000),
      },
    });
    safe();
    await prisma.ticketType.create({
      data: {
        id: ids.type,
        eventId: ids.event,
        name: 'GA',
        price: 10,
        quantityTotal: 2,
        quantityAvailable: 0,
        quantitySold: 2,
      },
    });
    for (const [userId, orderId, ticketId] of [
      [ids.a, ids.order, ids.ticket],
      [ids.b, ids.foreignOrder, ids.foreignTicket],
    ]) {
      safe();
      await prisma.order.create({
        data: {
          id: orderId,
          userId,
          eventId: ids.event,
          orderNumber: orderId,
          status: 'PAID',
          paymentStatus: 'SUCCEEDED',
          totalAmount: 10,
          currency: 'cad',
        },
      });
      safe();
      await prisma.ticket.create({
        data: {
          id: ticketId,
          userId,
          orderId,
          eventId: ids.event,
          ticketTypeId: ids.type,
          barcode: ticketId,
          inventoryState: 'SOLD',
          pricePaid: 10,
        },
      });
      const { ticketService } = await import('../../src/api/tickets/service');
      safe();
      await ticketService.getTicketQRCode(ticketId, userId);
    }
  })();
  return work;
}, 30000);
afterEach(async () => {
  safe();
  await bounded(Promise.allSettled(work ? [work] : []).then(() => undefined));
  await bounded(drain());
  work = (async () => {
    safe();
    await prisma.buyerPasswordReset.deleteMany({ where: { userId: { in: [ids.a, ids.b] } } });
    safe();
    await prisma.ticket.deleteMany({ where: { eventId: ids.event } });
    safe();
    await prisma.order.deleteMany({ where: { id: { in: [ids.order, ids.foreignOrder] } } });
    safe();
    await prisma.ticketType.deleteMany({ where: { id: ids.type } });
    safe();
    await prisma.event.deleteMany({ where: { id: ids.event } });
    safe();
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    safe();
    await prisma.user.deleteMany({ where: { id: { in: [ids.a, ids.b] } } });
  })();
  await bounded(work);
}, 15000);
afterAll(async () => {
  if (unsafe) return;
  await bounded(drain());
  await bounded(track(prisma.$disconnect()));
  for (const spy of spies.reverse()) spy.mockRestore();
});
const initiate = async (email = `${ids.a}@synthetic.test`) => {
  const result = await request(app).post('/api/v1/auth/forgot-password').send({ email });
  await bounded(drain());
  return result;
};
const tokenFromCapture = () => {
  const calls = (transporter.sendMail as jest.Mock).mock.calls;
  const text = calls.at(-1)![0].text as string;
  const link = text.match(/https:\/\/buyer\.synthetic\.test\/reset-password#token=([a-f0-9]{64})/);
  expect(Boolean(link)).toBe(true);
  return link![1];
};
const reset = (token: string, value = nextPassword) =>
  request(app).post('/api/v1/auth/reset-password').send({ token, password: value });
const login = (id: string, value = password) =>
  request(app)
    .post('/api/v1/auth/login')
    .send({ email: `${id}@synthetic.test`, password: value });
const financial = async () => ({
  orders: await prisma.order.findMany({ where: { eventId: ids.event }, orderBy: { id: 'asc' } }),
  tickets: await prisma.ticket.findMany({ where: { eventId: ids.event }, orderBy: { id: 'asc' } }),
  stock: await prisma.ticketType.findUnique({ where: { id: ids.type } }),
  attempts: await prisma.paymentAttempt.findMany({
    where: { orderId: { in: [ids.order, ids.foreignOrder] } },
  }),
  refunds: await prisma.paymentRefund.findMany({
    where: { orderId: { in: [ids.order, ids.foreignOrder] } },
  }),
});
testCase(
  'email-possession reset is hashed, single-use, revokes old sessions and preserves tickets/foreign ownership',
  async () => {
    const old = await login(ids.a);
    expect(old.status).toBe(200);
    const foreignBefore = await prisma.user.findUniqueOrThrow({ where: { id: ids.b } });
    const account = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } }),
      before = await financial();
    const accepted = await initiate();
    expect(accepted.status).toBe(202);
    expect(accepted.body.data).toBeNull();
    const token = tokenFromCapture(),
      row = await prisma.buyerPasswordReset.findUniqueOrThrow({ where: { userId: ids.a } });
    expect(row.tokenHash === token).toBe(false);
    expect(row.tokenHash === createHash('sha256').update(token).digest('hex')).toBe(true);
    expect(row.email).toBe(account.email);
    expect(row.sessionVersion).toBe(account.sessionVersion);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(14 * 60000);
    const result = await reset(token);
    expect(result.status).toBe(200);
    expect(result.body.data).toBeNull();
    expect((await reset(token)).status).toBe(401);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
    expect(await comparePassword(nextPassword, after.passwordHash)).toBe(true);
    expect({
      ...after,
      passwordHash: account.passwordHash,
      sessionVersion: account.sessionVersion,
      updatedAt: account.updatedAt,
    }).toEqual(account);
    expect(after.sessionVersion).toBe(account.sessionVersion + 1);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${old.body.data.accessToken}`)
      ).status
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: old.body.data.refreshToken })
      ).status
    ).toBe(401);
    expect((await login(ids.a)).status).toBe(401);
    const fresh = await login(ids.a, nextPassword);
    expect(fresh.status).toBe(200);
    expect(
      (
        await request(app)
          .get(`/api/v1/tickets/${ids.ticket}/qr`)
          .set('Authorization', `Bearer ${fresh.body.data.accessToken}`)
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .get(`/api/v1/tickets/${ids.foreignTicket}/qr`)
          .set('Authorization', `Bearer ${fresh.body.data.accessToken}`)
      ).status
    ).toBe(403);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ids.b } })).toEqual(foreignBefore);
    expect(await financial()).toEqual(before);
  }
);
testCase('racing redemptions commit exactly one password/session change', async () => {
  await initiate();
  const token = tokenFromCapture();
  const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
  const passwordModule = await import('../../src/utils/password');
  const originalHash = passwordModule.hashPassword;
  let release!: () => void,
    entered = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const hashing = jest.spyOn(passwordModule, 'hashPassword').mockImplementation(async (value) => {
    const result = await originalHash(value);
    entered++;
    if (entered === 2) release();
    await gate;
    return result;
  });
  const clients = [
    reset(token).then((result) => result),
    reset(token, 'Synthetic-Other3!').then((result) => result),
  ];
  let results: request.Response[];
  try {
    results = await bounded(Promise.all(clients));
    expect(entered).toBe(2);
  } finally {
    release();
    await bounded(Promise.allSettled(clients));
    hashing.mockRestore();
  }
  expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
  const after = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
  expect(after.sessionVersion).toBe(before.sessionVersion + 1);
  expect(await prisma.buyerPasswordReset.count({ where: { userId: ids.a } })).toBe(0);
  expect(
    (
      await Promise.all([
        comparePassword(nextPassword, after.passwordHash),
        comparePassword('Synthetic-Other3!', after.passwordHash),
      ])
    ).filter(Boolean)
  ).toHaveLength(1);
});
testCase('cooldown retains issued link and a later issue invalidates the older link', async () => {
  const first = await initiate(),
    old = tokenFromCapture();
  expect((await initiate()).body).toEqual(first.body);
  expect(transporter.sendMail).toHaveBeenCalledTimes(1);
  await prisma.buyerPasswordReset.update({
    where: { userId: ids.a },
    data: { createdAt: new Date(Date.now() - 61000) },
  });
  await initiate();
  const newer = tokenFromCapture();
  expect(newer === old).toBe(false);
  expect((await reset(old)).status).toBe(401);
  expect((await reset(newer)).status).toBe(200);
});
testCase(
  'unknown, disabled, nonbuyer, platform and MFA identities share generic initiation without mail or account changes',
  async () => {
    const generic = await initiate('missing@synthetic.test');
    expect(generic.status).toBe(202);
    for (const changes of [
      { disabledAt: new Date() },
      ...(['OWNER', 'ADMIN', 'MANAGER', 'PROMOTER', 'SCANNER', 'TEAM_MEMBER'] as const).map(
        (role) => ({ role })
      ),
      { isPlatformAdmin: true },
      { twoFactorEnabled: true },
    ]) {
      await prisma.user.update({
        where: { id: ids.a },
        data: {
          role: 'CUSTOMER',
          disabledAt: null,
          isPlatformAdmin: false,
          twoFactorEnabled: false,
          ...changes,
        },
      });
      const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
      const result = await initiate();
      expect(result.status).toBe(generic.status);
      expect(result.body).toEqual(generic.body);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: ids.a } })).toEqual(before);
      expect(await prisma.buyerPasswordReset.count({ where: { userId: ids.a } })).toBe(0);
    }
    expect(transporter.sendMail).not.toHaveBeenCalled();
  }
);
testCase(
  'expired, changed-email/version/role/disabled/MFA proofs and weak passwords fail closed',
  async () => {
    await initiate();
    const token = tokenFromCapture();
    const baseline = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
    for (const changes of [
      { email: 'changed@synthetic.test' },
      { sessionVersion: 7 },
      { role: 'MANAGER' as const },
      { disabledAt: new Date() },
      { twoFactorEnabled: true },
      { isPlatformAdmin: true },
    ]) {
      await prisma.user.update({
        where: { id: ids.a },
        data: {
          email: baseline.email,
          sessionVersion: baseline.sessionVersion,
          role: 'CUSTOMER',
          disabledAt: null,
          twoFactorEnabled: false,
          isPlatformAdmin: false,
          ...changes,
        },
      });
      const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
      expect((await reset(token)).status).toBe(401);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: ids.a } })).toEqual(before);
    }
    await prisma.user.update({
      where: { id: ids.a },
      data: {
        email: baseline.email,
        sessionVersion: baseline.sessionVersion,
        role: 'CUSTOMER',
        disabledAt: null,
        twoFactorEnabled: false,
        isPlatformAdmin: false,
      },
    });
    for (const weak of ['short', 'alllowercase1!', 'NoSpecial123', 'A'.repeat(73) + 'a1!'])
      expect((await reset(token, weak)).status).toBe(400);
    await prisma.buyerPasswordReset.update({
      where: { userId: ids.a },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
    expect((await reset(token)).status).toBe(401);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ids.a } })).toEqual(before);
  }
);
testCase(
  'failed older delivery removes only its own token and cannot delete a newer issuance',
  async () => {
    let release!: () => void;
    let started!: () => void;
    let secondStarted!: () => void;
    const secondBegan = new Promise<void>((resolve) => {
      secondStarted = resolve;
    });
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (transporter.sendMail as jest.Mock)
      .mockImplementationOnce(async () => {
        started();
        await gate;
        throw new Error('Synthetic rejected delivery');
      })
      .mockImplementationOnce(() => {
        secondStarted();
        return Promise.resolve({ messageId: 'synthetic-capture' });
      });
    const first = request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: `${ids.a}@synthetic.test` })
      .then((result) => result);
    try {
      await bounded(began);
      expect((await first).status).toBe(202);
      await prisma.buyerPasswordReset.update({
        where: { userId: ids.a },
        data: { createdAt: new Date(Date.now() - 61000) },
      });
      const newer = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: `${ids.a}@synthetic.test` });
      expect(newer.status).toBe(202);
      // The newer real SQL issuance has reached its independent transport call.
      await bounded(secondBegan);
      expect(transporter.sendMail).toHaveBeenCalledTimes(2);
      const token = tokenFromCapture();
      release();
      await bounded(drain());
      expect((await reset(token)).status).toBe(200);
    } finally {
      release();
      await bounded(first);
      await bounded(drain());
    }
  }
);

testCase(
  'a foreign buyer proof changes only that buyer and cannot accept a caller-selected target',
  async () => {
    const aBefore = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
    const before = await financial();
    await initiate(`${ids.b}@synthetic.test`);
    const token = tokenFromCapture();
    expect(
      (
        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({ token, password: nextPassword, userId: ids.a })
      ).status
    ).toBe(400);
    expect((await reset(token)).status).toBe(200);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ids.a } })).toEqual(aBefore);
    expect((await login(ids.a)).status).toBe(200);
    expect((await login(ids.b, nextPassword)).status).toBe(200);
    expect(await financial()).toEqual(before);
  }
);

testCase(
  'email-possession recovery does not grant verification or alter buyer authority',
  async () => {
    await prisma.user.update({ where: { id: ids.a }, data: { emailVerified: false } });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
    await initiate();
    expect((await reset(tokenFromCapture())).status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
    expect(after.emailVerified).toBe(false);
    expect(after.role).toBe(before.role);
    expect(after.organizationId).toBe(before.organizationId);
    expect(after.isPlatformAdmin).toBe(false);
    expect(after.twoFactorEnabled).toBe(false);
  }
);

testCase(
  'delivery failure gives the same accepted response and removes its unusable proof without account changes',
  async () => {
    const baseline = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
    const generic = await initiate('missing@synthetic.test');
    (transporter.sendMail as jest.Mock).mockRejectedValueOnce(
      new Error('Synthetic transport rejection')
    );
    const rejected = await initiate();
    expect(rejected.status).toBe(generic.status);
    expect(rejected.body).toEqual(generic.body);
    expect(await prisma.buyerPasswordReset.count({ where: { userId: ids.a } })).toBe(0);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ids.a } })).toEqual(baseline);
  }
);

testCase(
  'a rejected post-commit change notice cannot undo reset success or session revocation',
  async () => {
    const old = await login(ids.a);
    expect(old.status).toBe(200);
    const before = await financial();
    await initiate();
    const token = tokenFromCapture();
    (transporter.sendMail as jest.Mock).mockRejectedValueOnce(
      new Error('Synthetic changed-notice rejection')
    );
    expect((await reset(token)).status).toBe(200);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${old.body.data.accessToken}`)
      ).status
    ).toBe(401);
    expect((await login(ids.a, nextPassword)).status).toBe(200);
    expect(await prisma.buyerPasswordReset.count({ where: { userId: ids.a } })).toBe(0);
    expect(await financial()).toEqual(before);
  }
);

testCase(
  'mounted recovery rate-limits a synthetic source without account or token changes',
  async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ids.a } });
    const statuses: number[] = [];
    for (let n = 0; n < 6; n++) {
      const result = await request(app)
        .post('/api/v1/auth/forgot-password')
        .set('x-forwarded-for', '192.0.2.250')
        .set('x-test-rate-limit', 'strict')
        .send({ email: 'missing-rate@synthetic.test' });
      statuses.push(result.status);
      await bounded(drain());
    }
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
    expect(transporter.sendMail).not.toHaveBeenCalled();
    expect(await prisma.buyerPasswordReset.count({ where: { userId: ids.a } })).toBe(0);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ids.a } })).toEqual(before);
  }
);
