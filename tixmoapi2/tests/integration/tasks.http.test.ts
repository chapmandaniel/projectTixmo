import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { createEvent, createOrganization, prisma, registerUser } from '../utils/testUtils';

describe('Tasks HTTP', () => {
  const key = `t117-tasks-${randomUUID()}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  let owner: { user: { id: string }; accessToken: string };
  let teammate: { user: { id: string }; accessToken: string };
  let foreign: { user: { id: string }; accessToken: string };
  let noOrg: { user: { id: string }; accessToken: string };
  let org: { id: string };
  let event: { id: string };
  let otherEvent: { id: string };

  beforeAll(async () => {
    owner = await registerUser(app, {
      email: `${key}-owner@test.invalid`,
      firstName: 'Alex',
      lastName: 'Reed',
      role: 'OWNER',
    });
    org = await createOrganization(app, owner.accessToken, {
      name: `${key} Org`,
      slug: `${key}-org`,
    });
    teammate = await registerUser(app, {
      email: `${key}-sam@test.invalid`,
      firstName: 'Sam',
      lastName: 'Lee',
      role: 'MANAGER',
    });
    await prisma.user.update({
      where: { id: teammate.user.id },
      data: { organizationId: org.id },
    });
    foreign = await registerUser(app, {
      email: `${key}-foreign@test.invalid`,
      firstName: 'Pat',
      lastName: 'Other',
      role: 'OWNER',
    });
    await createOrganization(app, foreign.accessToken, {
      name: `${key} Other`,
      slug: `${key}-other`,
    });
    otherEvent = await createEvent(app, foreign.accessToken, {
      organizationId: (await prisma.user.findUniqueOrThrow({ where: { id: foreign.user.id } }))
        .organizationId!,
      title: `${key} Other Show`,
    });
    noOrg = await registerUser(app, {
      email: `${key}-noorg@test.invalid`,
      firstName: 'No',
      lastName: 'Org',
    });
    event = await createEvent(app, owner.accessToken, {
      organizationId: org.id,
      title: `${key} Night Show`,
    });
  });

  afterAll(async () => {
    await prisma.taskComment.deleteMany({
      where: { task: { organization: { slug: { startsWith: key } } } },
    });
    await prisma.notification.deleteMany({
      where: { user: { email: { startsWith: key } } },
    });
    await prisma.task.deleteMany({
      where: { organization: { slug: { startsWith: key } } },
    });
    await prisma.event.deleteMany({
      where: { organization: { slug: { startsWith: key } } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { user: { email: { startsWith: key } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: key } } });
  });

  const createTask = (token: string, body: Record<string, unknown>) =>
    request(app).post('/api/v1/tasks').set(auth(token)).send(body);

  it('creates, lists, reads, patches, comments on, and deletes a task', async () => {
    const created = await createTask(owner.accessToken, {
      title: 'Print wristbands',
      description: 'Pack 400 bands for doors',
      priority: 'HIGH',
      tag: 'OPS',
      eventId: event.id,
      assigneeId: teammate.user.id,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: 'Print wristbands',
      description: 'Pack 400 bands for doors',
      status: 'TO_DO',
      priority: 'HIGH',
      tag: 'OPS',
      eventId: event.id,
      assigneeId: teammate.user.id,
      organizationId: org.id,
    });
    expect(created.body.id).toEqual(expect.any(String));
    const taskId = created.body.id as string;

    const listed = await request(app).get('/api/v1/tasks').set(auth(owner.accessToken));
    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body)).toBe(true);
    expect(listed.body.map((row: { id: string }) => row.id)).toContain(taskId);

    const byEvent = await request(app)
      .get('/api/v1/tasks')
      .query({ eventId: event.id, status: 'TO_DO', priority: 'HIGH', tag: 'OPS' })
      .set(auth(owner.accessToken));
    expect(byEvent.status).toBe(200);
    expect(byEvent.body.map((row: { id: string }) => row.id)).toContain(taskId);

    const otherStatus = await request(app)
      .get('/api/v1/tasks')
      .query({ status: 'DONE' })
      .set(auth(owner.accessToken));
    expect(otherStatus.status).toBe(200);
    expect(otherStatus.body.map((row: { id: string }) => row.id)).not.toContain(taskId);

    const detail = await request(app).get(`/api/v1/tasks/${taskId}`).set(auth(owner.accessToken));
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(taskId);
    expect(detail.body.event).toMatchObject({ id: event.id, name: `${key} Night Show` });
    expect(detail.body.assignee).toMatchObject({
      id: teammate.user.id,
      firstName: 'Sam',
      lastName: 'Lee',
    });

    const patched = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set(auth(owner.accessToken))
      .send({ status: 'IN_PROGRESS', title: 'Print and pack wristbands' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      id: taskId,
      status: 'IN_PROGRESS',
      title: 'Print and pack wristbands',
    });

    const commented = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set(auth(teammate.accessToken))
      .send({ content: 'Printer is booked for 4pm' });
    expect(commented.status).toBe(201);
    expect(commented.body).toMatchObject({
      taskId,
      userId: teammate.user.id,
      content: 'Printer is booked for 4pm',
    });
    expect(commented.body.id).toEqual(expect.any(String));

    const withComment = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set(auth(owner.accessToken));
    expect(withComment.status).toBe(200);
    expect(withComment.body.comments.map((row: { content: string }) => row.content)).toContain(
      'Printer is booked for 4pm'
    );

    const deleted = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set(auth(owner.accessToken));
    expect(deleted.status).toBe(204);

    const missing = await request(app).get(`/api/v1/tasks/${taskId}`).set(auth(owner.accessToken));
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Task not found');
  });

  it('rejects unauthenticated task reads and writes', async () => {
    const listed = await request(app).get('/api/v1/tasks');
    expect(listed.status).toBe(401);

    const created = await request(app).post('/api/v1/tasks').send({ title: 'No token' });
    expect(created.status).toBe(401);

    const unknown = randomUUID();
    expect((await request(app).get(`/api/v1/tasks/${unknown}`)).status).toBe(401);
    expect((await request(app).patch(`/api/v1/tasks/${unknown}`).send({ title: 'x' })).status).toBe(
      401
    );
    expect((await request(app).delete(`/api/v1/tasks/${unknown}`)).status).toBe(401);
    expect(
      (await request(app).post(`/api/v1/tasks/${unknown}/comments`).send({ content: 'hi' })).status
    ).toBe(401);
  });

  it('rejects a user with no organization', async () => {
    const listed = await request(app).get('/api/v1/tasks').set(auth(noOrg.accessToken));
    expect(listed.status).toBe(403);
    expect(listed.body.message).toBe('User does not belong to an organization');

    const created = await createTask(noOrg.accessToken, { title: 'Should not land' });
    expect(created.status).toBe(403);
    expect(created.body.message).toBe('User does not belong to an organization');
  });

  it('does not let another organization read, change, comment on, or delete a task', async () => {
    const created = await createTask(owner.accessToken, { title: 'Internal follow-up' });
    expect(created.status).toBe(201);
    const taskId = created.body.id as string;

    const hiddenList = await request(app).get('/api/v1/tasks').set(auth(foreign.accessToken));
    expect(hiddenList.status).toBe(200);
    expect(hiddenList.body.map((row: { id: string }) => row.id)).not.toContain(taskId);

    const hiddenDetail = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set(auth(foreign.accessToken));
    expect(hiddenDetail.status).toBe(404);

    const hiddenPatch = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set(auth(foreign.accessToken))
      .send({ status: 'DONE' });
    expect(hiddenPatch.status).toBe(404);

    const hiddenComment = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set(auth(foreign.accessToken))
      .send({ content: 'Should not attach' });
    expect(hiddenComment.status).toBe(404);

    const hiddenDelete = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set(auth(foreign.accessToken));
    expect(hiddenDelete.status).toBe(404);

    const stillThere = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set(auth(owner.accessToken));
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.status).toBe('TO_DO');
  });

  it('assigns, then unassigns a teammate and event on patch', async () => {
    const created = await createTask(owner.accessToken, { title: 'Temporary assignment' });
    expect(created.status).toBe(201);
    expect(created.body.assigneeId).toBeNull();
    expect(created.body.eventId).toBeNull();

    const assigned = await request(app)
      .patch(`/api/v1/tasks/${created.body.id}`)
      .set(auth(owner.accessToken))
      .send({ assigneeId: teammate.user.id, eventId: event.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.assigneeId).toBe(teammate.user.id);
    expect(assigned.body.eventId).toBe(event.id);

    const patched = await request(app)
      .patch(`/api/v1/tasks/${created.body.id}`)
      .set(auth(owner.accessToken))
      .send({ assigneeId: null, eventId: null });
    expect(patched.status).toBe(200);
    expect(patched.body.assigneeId).toBeNull();
    expect(patched.body.eventId).toBeNull();
  });

  it('returns 404 for a missing task id on get, patch, delete, and comment', async () => {
    const missing = randomUUID();
    expect(
      (await request(app).get(`/api/v1/tasks/${missing}`).set(auth(owner.accessToken))).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/v1/tasks/${missing}`)
          .set(auth(owner.accessToken))
          .send({ title: 'gone' })
      ).status
    ).toBe(404);
    expect(
      (await request(app).delete(`/api/v1/tasks/${missing}`).set(auth(owner.accessToken))).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`/api/v1/tasks/${missing}/comments`)
          .set(auth(owner.accessToken))
          .send({ content: 'gone' })
      ).status
    ).toBe(404);
  });

  it('rejects missing title, invalid enums, invalid ids, and empty comments', async () => {
    const noTitle = await createTask(owner.accessToken, { description: 'no title' });
    expect(noTitle.status).toBe(400);
    expect(noTitle.body.message).toBe('Validation failed');

    const badPriority = await createTask(owner.accessToken, {
      title: 'Bad priority',
      priority: 'URGENT',
    });
    expect(badPriority.status).toBe(400);

    const badEvent = await createTask(owner.accessToken, {
      title: 'Bad event id',
      eventId: 'not-a-uuid',
    });
    expect(badEvent.status).toBe(400);

    const unknownEvent = await createTask(owner.accessToken, {
      title: 'Foreign event',
      eventId: otherEvent.id,
    });
    expect(unknownEvent.status).toBe(404);
    expect(unknownEvent.body.message).toMatch(/not found/i);

    const created = await createTask(owner.accessToken, { title: 'Needs a comment' });
    expect(created.status).toBe(201);

    const emptyComment = await request(app)
      .post(`/api/v1/tasks/${created.body.id}/comments`)
      .set(auth(owner.accessToken))
      .send({ content: '' });
    expect(emptyComment.status).toBe(400);

    const badId = await request(app).get('/api/v1/tasks/not-a-uuid').set(auth(owner.accessToken));
    expect(badId.status).toBe(400);
  });

  it('notifies an org teammate mentioned in a comment and not a user in another org', async () => {
    const created = await createTask(owner.accessToken, { title: 'Door briefing' });
    expect(created.status).toBe(201);
    const taskId = created.body.id as string;

    const commented = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set(auth(owner.accessToken))
      .send({ content: '@Sam Lee please confirm radios' });
    expect(commented.status).toBe(201);

    let mention: { type?: string; userId?: string; subject?: string } | undefined;
    for (let attempt = 0; attempt < 20 && !mention; attempt += 1) {
      const inbox = await request(app)
        .get('/api/v1/notifications')
        .query({ unreadOnly: 'true' })
        .set(auth(teammate.accessToken));
      expect(inbox.status).toBe(200);
      mention = (inbox.body.data?.notifications || []).find(
        (row: { type: string; metadata?: { taskId?: string } }) =>
          row.type === 'TASK_MENTION' && row.metadata?.taskId === taskId
      );
      if (!mention) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(mention).toMatchObject({
      userId: teammate.user.id,
      type: 'TASK_MENTION',
    });
    expect(mention?.subject).toMatch(/Door briefing/);

    const foreignInbox = await request(app)
      .get('/api/v1/notifications')
      .query({ unreadOnly: 'true' })
      .set(auth(foreign.accessToken));
    expect(foreignInbox.status).toBe(200);
    expect(
      (foreignInbox.body.data?.notifications || []).filter(
        (row: { type: string }) => row.type === 'TASK_MENTION'
      )
    ).toEqual([]);
  });

  it('writes a TASK_MENTION notification row for a first-name @mention followed by sentence text', async () => {
    // T140/T142: QA posted "@Qat140mnt please see this" and got no row because
    // the parser consumed "please" as a last name. Mentions are now awaited, so
    // the row must exist as soon as the comment 201 returns.
    const created = await createTask(owner.accessToken, { title: 'Radio check' });
    expect(created.status).toBe(201);
    const taskId = created.body.id as string;

    const commented = await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set(auth(owner.accessToken))
      .send({ content: '@Sam please see this.' });
    expect(commented.status).toBe(201);

    const inbox = await request(app)
      .get('/api/v1/notifications')
      .query({ unreadOnly: 'true' })
      .set(auth(teammate.accessToken));
    expect(inbox.status).toBe(200);
    const mention = (inbox.body.data?.notifications || []).find(
      (row: { type: string; metadata?: { taskId?: string } }) =>
        row.type === 'TASK_MENTION' && row.metadata?.taskId === taskId
    );
    expect(mention).toMatchObject({
      userId: teammate.user.id,
      type: 'TASK_MENTION',
      subject: expect.stringMatching(/Radio check/),
    });

    const row = await prisma.notification.findFirst({
      where: {
        userId: teammate.user.id,
        type: 'TASK_MENTION',
        metadata: { path: ['taskId'], equals: taskId },
      },
    });
    expect(row).not.toBeNull();
    expect(row?.userId).toBe(teammate.user.id);
  });
});
