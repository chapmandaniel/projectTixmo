import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { registerUser } from '../utils/testUtils';

describe('organization membership authorization', () => {
  const key = `org-mem-${randomUUID()}`;
  let orgAId = '';
  let orgBId = '';
  let orgAName = '';
  let ownerToken = '';
  let ownerId = '';
  let adminToken = '';
  let adminId = '';
  let globalToken = '';
  let memberBId = '';
  let outsiderId = '';

  beforeAll(async () => {
    const orgA = await prisma.organization.create({
      data: { name: `${key}-a`, slug: `${key}-a`, type: 'PROMOTER' },
    });
    const orgB = await prisma.organization.create({
      data: { name: `${key}-b`, slug: `${key}-b`, type: 'PROMOTER' },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;
    orgAName = orgA.name;

    const owner = await registerUser(app, {
      role: 'OWNER',
      email: `${key}-owner@test.invalid`,
    });
    ownerToken = owner.accessToken;
    ownerId = owner.user.id;
    await prisma.user.update({
      where: { id: ownerId },
      data: { organizationId: orgAId, isPlatformAdmin: false },
    });

    const admin = await registerUser(app, {
      role: 'ADMIN',
      email: `${key}-admin@test.invalid`,
    });
    adminToken = admin.accessToken;
    adminId = admin.user.id;
    await prisma.user.update({
      where: { id: adminId },
      data: { organizationId: orgAId, isPlatformAdmin: false },
    });

    const globalAdmin = await registerUser(app, {
      role: 'ADMIN',
      email: `${key}-platform@test.invalid`,
    });
    globalToken = globalAdmin.accessToken;

    const memberB = await registerUser(app, { email: `${key}-member-b@test.invalid` });
    memberBId = memberB.user.id;
    await prisma.user.update({
      where: { id: memberBId },
      data: { organizationId: orgBId },
    });

    const outsider = await registerUser(app, { email: `${key}-outsider@test.invalid` });
    outsiderId = outsider.user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: key } } });
    await prisma.$disconnect();
  });

  const userState = (id: string) =>
    prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        organizationId: true,
        role: true,
        sessionVersion: true,
        isPlatformAdmin: true,
      },
    });

  const orgState = (id: string) =>
    prisma.organization.findUniqueOrThrow({
      where: { id },
      select: { id: true, name: true, slug: true, status: true, updatedAt: true },
    });

  const expectForbidden = (
    response: { status: number; body: { success?: boolean; message?: string } },
    message: string
  ) => {
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ success: false, message });
  };

  it('rejects an org owner deleting another organization without changing it', async () => {
    const beforeOrg = await orgState(orgBId);
    const beforeMember = await userState(memberBId);

    const response = await request(app)
      .delete(`/api/v1/organizations/${orgBId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expectForbidden(response, 'You do not have permission to delete this organization');
    expect(await orgState(orgBId)).toEqual(beforeOrg);
    expect(await userState(memberBId)).toEqual(beforeMember);
  });

  it('rejects an org admin deleting another organization without changing it', async () => {
    const beforeOrg = await orgState(orgBId);
    const beforeMember = await userState(memberBId);

    const response = await request(app)
      .delete(`/api/v1/organizations/${orgBId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expectForbidden(response, 'You do not have permission to delete this organization');
    expect(await orgState(orgBId)).toEqual(beforeOrg);
    expect(await userState(memberBId)).toEqual(beforeMember);
  });

  it('rejects an org admin deleting their own organization', async () => {
    const beforeOrg = await orgState(orgAId);
    const beforeOwner = await userState(ownerId);

    const response = await request(app)
      .delete(`/api/v1/organizations/${orgAId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expectForbidden(response, 'You do not have permission to delete this organization');
    expect(await orgState(orgAId)).toEqual(beforeOrg);
    expect(await userState(ownerId)).toEqual(beforeOwner);
  });

  it('rejects an org owner adding a member to another organization', async () => {
    const before = await userState(outsiderId);

    const response = await request(app)
      .post(`/api/v1/organizations/${orgBId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: outsiderId });

    expectForbidden(response, 'You do not have permission to add members to this organization');
    expect(await userState(outsiderId)).toEqual(before);
    expect(await userState(memberBId)).toMatchObject({ organizationId: orgBId });
  });

  it('rejects an org admin adding a member to another organization', async () => {
    const before = await userState(outsiderId);

    const response = await request(app)
      .post(`/api/v1/organizations/${orgBId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: outsiderId });

    expectForbidden(response, 'You do not have permission to add members to this organization');
    expect(await userState(outsiderId)).toEqual(before);
  });

  it('rejects an org owner removing a member from another organization', async () => {
    const before = await userState(memberBId);

    const response = await request(app)
      .delete(`/api/v1/organizations/${orgBId}/members/${memberBId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expectForbidden(
      response,
      'You do not have permission to remove members from this organization'
    );
    expect(await userState(memberBId)).toEqual(before);
  });

  it('rejects an org admin removing a member from another organization', async () => {
    const before = await userState(memberBId);

    const response = await request(app)
      .delete(`/api/v1/organizations/${orgBId}/members/${memberBId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expectForbidden(
      response,
      'You do not have permission to remove members from this organization'
    );
    expect(await userState(memberBId)).toEqual(before);
  });

  it('rejects an org owner adopting a manager or owner from another organization', async () => {
    const manager = await registerUser(app, {
      role: 'MANAGER',
      email: `${key}-manager-b@test.invalid`,
    });
    await prisma.user.update({
      where: { id: manager.user.id },
      data: { organizationId: orgBId, role: 'MANAGER', isPlatformAdmin: false },
    });
    const ownerB = await registerUser(app, {
      role: 'OWNER',
      email: `${key}-owner-b@test.invalid`,
    });
    await prisma.user.update({
      where: { id: ownerB.user.id },
      data: { organizationId: orgBId, role: 'OWNER', isPlatformAdmin: false },
    });

    const beforeManager = await userState(manager.user.id);
    const beforeOwnerB = await userState(ownerB.user.id);
    const beforeMembers = await prisma.user.findMany({
      where: { organizationId: orgBId },
      select: { id: true, organizationId: true, role: true },
      orderBy: { id: 'asc' },
    });

    const addManager = await request(app)
      .post(`/api/v1/organizations/${orgAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: manager.user.id });
    expectForbidden(addManager, 'You do not have permission to add members to this organization');

    const addOwner = await request(app)
      .post(`/api/v1/organizations/${orgAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: ownerB.user.id });
    expectForbidden(addOwner, 'You do not have permission to add members to this organization');

    expect(await userState(manager.user.id)).toEqual(beforeManager);
    expect(await userState(ownerB.user.id)).toEqual(beforeOwnerB);
    expect(beforeManager).toMatchObject({ organizationId: orgBId, role: 'MANAGER' });
    expect(beforeOwnerB).toMatchObject({ organizationId: orgBId, role: 'OWNER' });
    expect(
      await prisma.user.findMany({
        where: { organizationId: orgBId },
        select: { id: true, organizationId: true, role: true },
        orderBy: { id: 'asc' },
      })
    ).toEqual(beforeMembers);
  });

  it('lets an org owner add an unaffiliated user', async () => {
    const recruit = await registerUser(app, { email: `${key}-unaffiliated@test.invalid` });
    expect(await userState(recruit.user.id)).toMatchObject({
      organizationId: null,
      role: 'CUSTOMER',
    });

    const added = await request(app)
      .post(`/api/v1/organizations/${orgAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: recruit.user.id });

    expect(added.status).toBe(200);
    expect(added.body).toMatchObject({ success: true, message: 'Member added successfully' });
    expect(await userState(recruit.user.id)).toMatchObject({
      organizationId: orgAId,
      role: 'CUSTOMER',
    });
  });

  it('lets an org owner add and remove members of their own organization', async () => {
    const recruit = await registerUser(app, { email: `${key}-recruit-owner@test.invalid` });

    const added = await request(app)
      .post(`/api/v1/organizations/${orgAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: recruit.user.id });

    expect(added.status).toBe(200);
    expect(added.body).toMatchObject({ success: true, message: 'Member added successfully' });
    expect(await userState(recruit.user.id)).toMatchObject({
      organizationId: orgAId,
      role: 'CUSTOMER',
    });

    const removed = await request(app)
      .delete(`/api/v1/organizations/${orgAId}/members/${recruit.user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ success: true, message: 'Member removed successfully' });
    expect(await userState(recruit.user.id)).toMatchObject({
      organizationId: null,
      role: 'CUSTOMER',
    });
  });

  it('lets an org admin add and remove members of their own organization', async () => {
    const recruit = await registerUser(app, { email: `${key}-recruit-admin@test.invalid` });

    const added = await request(app)
      .post(`/api/v1/organizations/${orgAId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: recruit.user.id });

    expect(added.status).toBe(200);
    expect(await userState(recruit.user.id)).toMatchObject({ organizationId: orgAId });

    const removed = await request(app)
      .delete(`/api/v1/organizations/${orgAId}/members/${recruit.user.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(removed.status).toBe(200);
    expect(await userState(recruit.user.id)).toMatchObject({ organizationId: null });
  });

  it('lets an org owner delete the organization they belong to', async () => {
    const org = await prisma.organization.create({
      data: { name: `${key}-owner-delete`, slug: `${key}-owner-delete`, type: 'PROMOTER' },
    });
    const owner = await registerUser(app, {
      role: 'OWNER',
      email: `${key}-delete-owner@test.invalid`,
    });
    await prisma.user.update({
      where: { id: owner.user.id },
      data: { organizationId: org.id, isPlatformAdmin: false },
    });

    const response = await request(app)
      .delete(`/api/v1/organizations/${org.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(204);
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).toBeNull();
  });

  it('lets a global admin delete any organization and manage its members', async () => {
    const org = await prisma.organization.create({
      data: { name: `${key}-global-delete`, slug: `${key}-global-delete`, type: 'PROMOTER' },
    });
    const recruit = await registerUser(app, { email: `${key}-recruit-global@test.invalid` });

    const added = await request(app)
      .post(`/api/v1/organizations/${orgBId}/members`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({ userId: recruit.user.id });
    expect(added.status).toBe(200);
    expect(await userState(recruit.user.id)).toMatchObject({ organizationId: orgBId });

    const removed = await request(app)
      .delete(`/api/v1/organizations/${orgBId}/members/${recruit.user.id}`)
      .set('Authorization', `Bearer ${globalToken}`);
    expect(removed.status).toBe(200);
    expect(await userState(recruit.user.id)).toMatchObject({ organizationId: null });
    expect(await userState(memberBId)).toMatchObject({ organizationId: orgBId });

    const deleted = await request(app)
      .delete(`/api/v1/organizations/${org.id}`)
      .set('Authorization', `Bearer ${globalToken}`);
    expect(deleted.status).toBe(204);
    expect(await prisma.organization.findUnique({ where: { id: org.id } })).toBeNull();
    expect(await orgState(orgBId)).toMatchObject({ id: orgBId });
  });

  it('still lets an org owner update their organization and blocks the other organization', async () => {
    const beforeB = await orgState(orgBId);

    const denied = await request(app)
      .put(`/api/v1/organizations/${orgBId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `${key}-hijack` });
    expectForbidden(denied, "You do not have access to this organization's resources");
    expect(await orgState(orgBId)).toEqual(beforeB);

    const renamed = `${key}-renamed`;
    const updated = await request(app)
      .put(`/api/v1/organizations/${orgAId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: renamed });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe(renamed);

    const restored = await request(app)
      .put(`/api/v1/organizations/${orgAId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: orgAName });
    expect(restored.status).toBe(200);
    expect(await orgState(orgAId)).toMatchObject({ name: orgAName });
  });
});
