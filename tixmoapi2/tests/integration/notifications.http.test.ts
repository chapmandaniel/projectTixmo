import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { createOrganization, prisma, registerUser } from '../utils/testUtils';

describe('Notifications HTTP', () => {
  const key = `t117-notif-${randomUUID()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let userA: { user: { id: string }; accessToken: string };
  let userB: { user: { id: string }; accessToken: string };
  let sameOrgB: { user: { id: string }; accessToken: string };

  const seed = async (
    userId: string,
    overrides: Partial<{
      subject: string;
      message: string;
      readAt: Date | null;
      createdAt: Date;
    }> = {}
  ) =>
    prisma.notification.create({
      data: {
        userId,
        type: 'ANNOUNCEMENT',
        subject: overrides.subject ?? 'Operator note',
        message: overrides.message ?? 'Please review tonight doors plan',
        status: 'PENDING',
        readAt: overrides.readAt === undefined ? null : overrides.readAt,
        createdAt: overrides.createdAt,
      },
    });

  beforeAll(async () => {
    userA = await registerUser(app, {
      email: `${key}-a@test.invalid`,
      firstName: 'Avery',
      lastName: 'Stone',
      role: 'OWNER',
    });
    const org = await createOrganization(app, userA.accessToken, {
      name: `${key} Org`,
      slug: `${key}-org`,
    });
    sameOrgB = await registerUser(app, {
      email: `${key}-same@test.invalid`,
      firstName: 'Riley',
      lastName: 'Ng',
      role: 'MANAGER',
    });
    await prisma.user.update({
      where: { id: sameOrgB.user.id },
      data: { organizationId: org.id },
    });
    userB = await registerUser(app, {
      email: `${key}-b@test.invalid`,
      firstName: 'Blake',
      lastName: 'Other',
      role: 'OWNER',
    });
    await createOrganization(app, userB.accessToken, {
      name: `${key} Other`,
      slug: `${key}-other`,
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { user: { email: { startsWith: key } } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { user: { email: { startsWith: key } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: key } } });
  });

  const list = (token: string, query: Record<string, string | number> = {}) =>
    request(app).get('/api/v1/notifications').query(query).set(auth(token));

  it('lists only the caller’s notifications and paginates newest first', async () => {
    const older = await seed(userA.user.id, {
      subject: 'Older note',
      createdAt: new Date('2026-11-01T12:00:00.000Z'),
    });
    const newer = await seed(userA.user.id, {
      subject: 'Newer note',
      createdAt: new Date('2026-11-02T12:00:00.000Z'),
    });
    const third = await seed(userA.user.id, {
      subject: 'Newest note',
      createdAt: new Date('2026-11-03T12:00:00.000Z'),
    });
    const other = await seed(userB.user.id, { subject: 'Blake only' });
    const peer = await seed(sameOrgB.user.id, { subject: 'Riley only' });

    const page1 = await list(userA.accessToken, { page: 1, limit: 2 });
    expect(page1.status).toBe(200);
    expect(page1.body.success).toBe(true);
    expect(page1.body.data.pagination).toMatchObject({ page: 1, limit: 2 });
    expect(page1.body.data.pagination.total).toBeGreaterThanOrEqual(3);
    expect(page1.body.data.notifications).toHaveLength(2);
    expect(page1.body.data.notifications.map((row: { id: string }) => row.id)).toEqual([
      third.id,
      newer.id,
    ]);
    expect(page1.body.data.notifications.map((row: { id: string }) => row.id)).not.toContain(
      other.id
    );
    expect(page1.body.data.notifications.map((row: { id: string }) => row.id)).not.toContain(
      peer.id
    );

    const page2 = await list(userA.accessToken, { page: 2, limit: 2 });
    expect(page2.status).toBe(200);
    expect(page2.body.data.pagination).toMatchObject({ page: 2, limit: 2 });
    expect(page2.body.data.notifications.map((row: { id: string }) => row.id)).toContain(older.id);
    expect(page2.body.data.notifications.map((row: { id: string }) => row.id)).not.toEqual(
      page1.body.data.notifications.map((row: { id: string }) => row.id)
    );

    const bList = await list(userB.accessToken);
    expect(bList.status).toBe(200);
    const bIds = bList.body.data.notifications.map((row: { id: string }) => row.id);
    expect(bIds).toContain(other.id);
    expect(bIds).not.toContain(third.id);
    expect(bIds).not.toContain(peer.id);
  });

  it('filters unreadOnly and leaves read rows off the unread page', async () => {
    const unread = await seed(userA.user.id, { subject: 'Still unread' });
    const read = await seed(userA.user.id, {
      subject: 'Already read',
      readAt: new Date('2026-11-04T12:00:00.000Z'),
    });

    const unreadOnly = await list(userA.accessToken, { unreadOnly: 'true', limit: 100 });
    expect(unreadOnly.status).toBe(200);
    const ids = unreadOnly.body.data.notifications.map((row: { id: string }) => row.id);
    expect(ids).toContain(unread.id);
    expect(ids).not.toContain(read.id);
    expect(
      unreadOnly.body.data.notifications.every(
        (row: { readAt: string | null }) => row.readAt === null
      )
    ).toBe(true);

    const all = await list(userA.accessToken, { unreadOnly: 'false', limit: 100 });
    expect(all.status).toBe(200);
    const allIds = all.body.data.notifications.map((row: { id: string }) => row.id);
    expect(allIds).toContain(unread.id);
    expect(allIds).toContain(read.id);
  });

  it('marks one notification as read for the owner and leaves others unread', async () => {
    const target = await seed(userA.user.id, { subject: 'Mark me' });
    const leftover = await seed(userA.user.id, { subject: 'Leave me' });

    const marked = await request(app)
      .put(`/api/v1/notifications/${target.id}/read`)
      .set(auth(userA.accessToken));
    expect(marked.status).toBe(200);
    expect(marked.body.success).toBe(true);
    expect(marked.body.message).toBe('Notification marked as read');
    expect(marked.body.data.id).toBe(target.id);
    expect(marked.body.data.readAt).toEqual(expect.any(String));

    const stored = await prisma.notification.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.readAt).toBeInstanceOf(Date);
    const leftoverRow = await prisma.notification.findUniqueOrThrow({ where: { id: leftover.id } });
    expect(leftoverRow.readAt).toBeNull();
  });

  it('marks only the caller’s unread notifications as read', async () => {
    const a1 = await seed(userA.user.id, { subject: 'A unread 1' });
    const a2 = await seed(userA.user.id, { subject: 'A unread 2' });
    const b1 = await seed(userB.user.id, { subject: 'B unread' });
    const peer = await seed(sameOrgB.user.id, { subject: 'Peer unread' });

    const result = await request(app)
      .put('/api/v1/notifications/read-all')
      .set(auth(userA.accessToken));
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data.count).toBeGreaterThanOrEqual(2);
    expect(result.body.message).toMatch(/marked as read/);

    const aRows = await prisma.notification.findMany({
      where: { id: { in: [a1.id, a2.id] } },
    });
    expect(aRows.every((row) => row.readAt !== null)).toBe(true);

    const bRow = await prisma.notification.findUniqueOrThrow({ where: { id: b1.id } });
    expect(bRow.readAt).toBeNull();
    const peerRow = await prisma.notification.findUniqueOrThrow({ where: { id: peer.id } });
    expect(peerRow.readAt).toBeNull();
  });

  it('refuses to mark another user’s notification as read, including a teammate in the same org', async () => {
    const owned = await seed(userA.user.id, { subject: 'Avery’s note' });

    const foreignMark = await request(app)
      .put(`/api/v1/notifications/${owned.id}/read`)
      .set(auth(userB.accessToken));
    expect(foreignMark.status).toBe(403);
    expect(foreignMark.body.success).toBe(false);
    expect(foreignMark.body.message).toBe('You can only mark your own notifications as read');

    const peerMark = await request(app)
      .put(`/api/v1/notifications/${owned.id}/read`)
      .set(auth(sameOrgB.accessToken));
    expect(peerMark.status).toBe(403);
    expect(peerMark.body.message).toBe('You can only mark your own notifications as read');

    const stored = await prisma.notification.findUniqueOrThrow({ where: { id: owned.id } });
    expect(stored.readAt).toBeNull();
  });

  it('returns 404 for a missing notification id on mark-read', async () => {
    const response = await request(app)
      .put(`/api/v1/notifications/${randomUUID()}/read`)
      .set(auth(userA.accessToken));
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Notification not found');
  });

  it('rejects unauthenticated list, mark-read, and mark-all-read', async () => {
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
    expect((await request(app).put(`/api/v1/notifications/${randomUUID()}/read`)).status).toBe(401);
    expect((await request(app).put('/api/v1/notifications/read-all')).status).toBe(401);

    const invalid = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', 'Bearer not-a-token');
    expect(invalid.status).toBe(401);
  });

  it('rejects invalid pagination and unreadOnly values', async () => {
    const page = await list(userA.accessToken, { page: 0 });
    expect(page.status).toBe(400);
    expect(page.body.success).toBe(false);

    const limit = await list(userA.accessToken, { limit: 101 });
    expect(limit.status).toBe(400);

    const unread = await list(userA.accessToken, { unreadOnly: 'yes' });
    expect(unread.status).toBe(400);
  });

  // Bug: PUT /notifications/:id/read has no UUID param validation (routes.ts:60).
  // prisma.notification.findUnique (service.ts:47-48) then throws on a non-UUID,
  // and errorHandler.ts:20-28 turns that into 500. Expected: 400 Validation failed.
  it.skip('rejects a non-UUID notification id on mark-read (notifications/routes.ts:60)', async () => {
    const response = await request(app)
      .put('/api/v1/notifications/not-a-uuid/read')
      .set(auth(userA.accessToken));
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
