import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma, registerUser } from '../utils/testUtils';

const PREFERENCE_FIELDS = [
  'emailOrderConfirm',
  'emailTicketTransfer',
  'emailEventReminder',
  'emailPromo',
  'emailAnnouncement',
  'smsOrderConfirm',
  'smsEventReminder',
] as const;

type PreferenceField = (typeof PREFERENCE_FIELDS)[number];

const DEFAULT_PREFERENCES: Record<PreferenceField, boolean> = {
  emailOrderConfirm: true,
  emailTicketTransfer: true,
  emailEventReminder: true,
  emailPromo: false,
  emailAnnouncement: true,
  smsOrderConfirm: false,
  smsEventReminder: false,
};

const flippedDefaults = (): Record<PreferenceField, boolean> =>
  Object.fromEntries(
    PREFERENCE_FIELDS.map((field) => [field, !DEFAULT_PREFERENCES[field]])
  ) as Record<PreferenceField, boolean>;

describe('Notification preferences', () => {
  const key = `notif-prefs-${randomUUID()}`;
  let userA: { user: { id: string }; accessToken: string };
  let userB: { user: { id: string }; accessToken: string };

  beforeAll(async () => {
    userA = await registerUser(app, { email: `${key}-a@test.invalid` });
    userB = await registerUser(app, { email: `${key}-b@test.invalid` });
  });

  afterAll(async () => {
    await prisma.notificationPreference.deleteMany({
      where: { user: { email: { startsWith: key } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const getPrefs = (token: string) =>
    request(app).get('/api/v1/notifications/preferences').set(auth(token));

  const putPrefs = (token: string, body: Record<string, unknown>) =>
    request(app).put('/api/v1/notifications/preferences').set(auth(token)).send(body);

  const expectPreferenceShape = (
    body: { success?: boolean; data?: Record<string, unknown> },
    expected: Record<PreferenceField, boolean>,
    userId: string
  ) => {
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ userId, ...expected });
    for (const field of PREFERENCE_FIELDS) {
      expect(body.data?.[field]).toBe(expected[field]);
    }
  };

  it('creates and returns default preferences for a new user on first view', async () => {
    const before = await prisma.notificationPreference.findUnique({
      where: { userId: userA.user.id },
    });
    expect(before).toBeNull();

    const response = await getPrefs(userA.accessToken);

    expect(response.status).toBe(200);
    expectPreferenceShape(response.body, DEFAULT_PREFERENCES, userA.user.id);

    const stored = await prisma.notificationPreference.findUniqueOrThrow({
      where: { userId: userA.user.id },
    });
    expect(stored).toMatchObject({ userId: userA.user.id, ...DEFAULT_PREFERENCES });
  });

  it.each(PREFERENCE_FIELDS)(
    'changes and saves %s without altering the other preference types',
    async (field) => {
      const starting = await getPrefs(userA.accessToken);
      expect(starting.status).toBe(200);
      const current = starting.body.data as Record<PreferenceField, boolean>;
      const nextValue = !current[field];

      const updated = await putPrefs(userA.accessToken, { [field]: nextValue });
      expect(updated.status).toBe(200);
      expect(updated.body.message).toBe('Notification preferences updated');
      expect(updated.body.data[field]).toBe(nextValue);
      for (const other of PREFERENCE_FIELDS) {
        if (other === field) continue;
        expect(updated.body.data[other]).toBe(current[other]);
      }
    }
  );

  it('persists every preference type across a later GET refetch', async () => {
    const desired = flippedDefaults();
    const saved = await putPrefs(userA.accessToken, desired);
    expect(saved.status).toBe(200);
    expectPreferenceShape(saved.body, desired, userA.user.id);

    const refetched = await getPrefs(userA.accessToken);
    expect(refetched.status).toBe(200);
    expectPreferenceShape(refetched.body, desired, userA.user.id);

    const stored = await prisma.notificationPreference.findUniqueOrThrow({
      where: { userId: userA.user.id },
    });
    expect(stored).toMatchObject({ userId: userA.user.id, ...desired });
  });

  it('creates defaults for a second new user without inheriting another user’s saved prefs', async () => {
    const before = await prisma.notificationPreference.findUnique({
      where: { userId: userB.user.id },
    });
    expect(before).toBeNull();

    const viewed = await getPrefs(userB.accessToken);
    expect(viewed.status).toBe(200);
    expectPreferenceShape(viewed.body, DEFAULT_PREFERENCES, userB.user.id);
    expect(viewed.body.data.userId).not.toBe(userA.user.id);
  });

  it('rejects unauthenticated and invalid-token reads and writes', async () => {
    const unauthenticatedGet = await request(app).get('/api/v1/notifications/preferences');
    expect(unauthenticatedGet.status).toBe(401);

    const unauthenticatedPut = await request(app)
      .put('/api/v1/notifications/preferences')
      .send({ emailPromo: true });
    expect(unauthenticatedPut.status).toBe(401);

    const invalidGet = await request(app)
      .get('/api/v1/notifications/preferences')
      .set('Authorization', 'Bearer not-a-token');
    expect(invalidGet.status).toBe(401);

    const invalidPut = await request(app)
      .put('/api/v1/notifications/preferences')
      .set('Authorization', 'Bearer not-a-token')
      .send({ emailPromo: true });
    expect(invalidPut.status).toBe(401);
  });

  it('lets a user read and change only their own preferences', async () => {
    const aBefore = await getPrefs(userA.accessToken);
    const bBefore = await getPrefs(userB.accessToken);
    expect(aBefore.status).toBe(200);
    expect(bBefore.status).toBe(200);

    const aUpdate = await putPrefs(userA.accessToken, {
      emailPromo: true,
      smsOrderConfirm: true,
      userId: userB.user.id,
      id: userB.user.id,
    });
    expect(aUpdate.status).toBe(200);
    expect(aUpdate.body.data.userId).toBe(userA.user.id);
    expect(aUpdate.body.data.emailPromo).toBe(true);
    expect(aUpdate.body.data.smsOrderConfirm).toBe(true);

    const bAfter = await getPrefs(userB.accessToken);
    expect(bAfter.status).toBe(200);
    expect(bAfter.body.data).toMatchObject({
      userId: userB.user.id,
      emailPromo: bBefore.body.data.emailPromo,
      smsOrderConfirm: bBefore.body.data.smsOrderConfirm,
    });

    const aStored = await prisma.notificationPreference.findUniqueOrThrow({
      where: { userId: userA.user.id },
    });
    const bStored = await prisma.notificationPreference.findUniqueOrThrow({
      where: { userId: userB.user.id },
    });
    expect(aStored.emailPromo).toBe(true);
    expect(bStored.emailPromo).toBe(bBefore.body.data.emailPromo);
    expect(aStored.userId).not.toBe(bStored.userId);
  });

  it('rejects a non-boolean preference value', async () => {
    const before = await prisma.notificationPreference.findUniqueOrThrow({
      where: { userId: userA.user.id },
    });

    const response = await putPrefs(userA.accessToken, { emailPromo: 'yes' });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    const after = await prisma.notificationPreference.findUniqueOrThrow({
      where: { userId: userA.user.id },
    });
    expect(after.emailPromo).toBe(before.emailPromo);
    expect(after.updatedAt).toEqual(before.updatedAt);
  });
});
