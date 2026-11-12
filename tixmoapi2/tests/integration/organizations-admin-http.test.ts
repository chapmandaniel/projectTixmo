import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma, registerUser } from '../utils/testUtils';

describe('Organization admin HTTP paths', () => {
  const key = `org-admin-http-${randomUUID()}`.slice(0, 40);
  let orgId = '';
  let ownerToken = '';
  let ownerId = '';
  let managerToken = '';
  let teamMemberToken = '';
  let customerToken = '';
  let otherOrgId = '';

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `${key}-home`, slug: `${key}-home`, type: 'PROMOTER', status: 'ACTIVE' },
    });
    orgId = org.id;
    const other = await prisma.organization.create({
      data: { name: `${key}-other`, slug: `${key}-other`, type: 'PROMOTER', status: 'ACTIVE' },
    });
    otherOrgId = other.id;

    const owner = await registerUser(app, { role: 'OWNER', email: `${key}-owner@test.invalid` });
    ownerToken = owner.accessToken;
    ownerId = owner.user.id;
    await prisma.user.update({
      where: { id: ownerId },
      data: { organizationId: orgId, isPlatformAdmin: false },
    });

    const manager = await registerUser(app, {
      role: 'MANAGER',
      email: `${key}-manager@test.invalid`,
    });
    managerToken = manager.accessToken;
    await prisma.user.update({
      where: { id: manager.user.id },
      data: { organizationId: orgId, isPlatformAdmin: false },
    });

    const member = await registerUser(app, {
      role: 'TEAM_MEMBER',
      email: `${key}-member@test.invalid`,
    });
    teamMemberToken = member.accessToken;
    await prisma.user.update({
      where: { id: member.user.id },
      data: { organizationId: orgId, isPlatformAdmin: false },
    });

    const customer = await registerUser(app, { email: `${key}-customer@test.invalid` });
    customerToken = customer.accessToken;
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { organization: { slug: { startsWith: key } } } });
    await prisma.venue.deleteMany({ where: { organization: { slug: { startsWith: key } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: key } } });
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('POST /api/v1/organizations', () => {
    it('creates an organization over HTTP with a unique slug', async () => {
      const slug = `${key}-created`;
      const response = await request(app)
        .post('/api/v1/organizations')
        .set(auth(ownerToken))
        .send({ name: `${key} Created`, slug, type: 'PROMOTER' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: `${key} Created`,
        slug,
        type: 'PROMOTER',
        status: 'PENDING',
      });
      const stored = await prisma.organization.findUniqueOrThrow({ where: { slug } });
      expect(stored.id).toBe(response.body.data.id);
      expect(stored.status).toBe('PENDING');
    });

    it('rejects a duplicate slug with 409', async () => {
      const slug = `${key}-dup`;
      const first = await request(app)
        .post('/api/v1/organizations')
        .set(auth(ownerToken))
        .send({ name: `${key} Dup`, slug, type: 'VENUE' });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post('/api/v1/organizations')
        .set(auth(ownerToken))
        .send({ name: `${key} Dup Two`, slug, type: 'VENUE' });
      expect(second.status).toBe(409);
      expect(second.body).toMatchObject({
        success: false,
        message: 'Organization with this slug already exists',
      });
      expect(await prisma.organization.count({ where: { slug } })).toBe(1);
    });

    it('rejects missing fields and an invalid slug', async () => {
      const missing = await request(app)
        .post('/api/v1/organizations')
        .set(auth(ownerToken))
        .send({ name: `${key} Incomplete` });
      expect(missing.status).toBe(400);

      const badSlug = await request(app)
        .post('/api/v1/organizations')
        .set(auth(ownerToken))
        .send({ name: `${key} Bad Slug`, slug: 'Not Valid', type: 'PROMOTER' });
      expect(badSlug.status).toBe(400);

      const badType = await request(app)
        .post('/api/v1/organizations')
        .set(auth(ownerToken))
        .send({ name: `${key} Bad Type`, slug: `${key}-bad-type`, type: 'CUSTOMER' });
      expect(badType.status).toBe(400);
    });

    it('blocks a non-admin and an unauthenticated caller from creating an organization', async () => {
      const member = await request(app)
        .post('/api/v1/organizations')
        .set(auth(teamMemberToken))
        .send({ name: `${key} Member Org`, slug: `${key}-member-org`, type: 'PROMOTER' });
      expect(member.status).toBe(403);

      const customer = await request(app)
        .post('/api/v1/organizations')
        .set(auth(customerToken))
        .send({ name: `${key} Customer Org`, slug: `${key}-customer-org`, type: 'PROMOTER' });
      expect(customer.status).toBe(403);

      const anonymous = await request(app)
        .post('/api/v1/organizations')
        .send({ name: `${key} Anon Org`, slug: `${key}-anon-org`, type: 'PROMOTER' });
      expect(anonymous.status).toBe(401);

      expect(
        await prisma.organization.count({
          where: { slug: { in: [`${key}-member-org`, `${key}-customer-org`, `${key}-anon-org`] } },
        })
      ).toBe(0);
    });
  });

  describe('PUT /api/v1/organizations/:id', () => {
    it('lets an org owner edit their organization', async () => {
      const renamed = `${key}-renamed`;
      const response = await request(app)
        .put(`/api/v1/organizations/${orgId}`)
        .set(auth(ownerToken))
        .send({ name: renamed });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe(renamed);
      expect(await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })).toMatchObject({
        name: renamed,
        slug: `${key}-home`,
      });

      const restored = await request(app)
        .put(`/api/v1/organizations/${orgId}`)
        .set(auth(ownerToken))
        .send({ name: `${key}-home` });
      expect(restored.status).toBe(200);
    });

    it('rejects editing another organization and a slug collision', async () => {
      const hijack = await request(app)
        .put(`/api/v1/organizations/${otherOrgId}`)
        .set(auth(ownerToken))
        .send({ name: `${key}-hijack` });
      expect(hijack.status).toBe(403);

      const collision = await request(app)
        .put(`/api/v1/organizations/${orgId}`)
        .set(auth(ownerToken))
        .send({ slug: `${key}-other` });
      expect(collision.status).toBe(409);
      expect(collision.body.message).toBe('Organization with this slug already exists');
      expect(await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })).toMatchObject({
        slug: `${key}-home`,
      });
    });

    it('blocks a TEAM_MEMBER from editing the organization they belong to', async () => {
      const before = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
      const response = await request(app)
        .put(`/api/v1/organizations/${orgId}`)
        .set(auth(teamMemberToken))
        .send({ name: `${key}-member-edit` });
      expect(response.status).toBe(403);
      expect(await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })).toEqual(before);
    });
  });

  describe('DELETE /api/v1/organizations/:id', () => {
    it('refuses to delete an organization that still has a venue or event', async () => {
      const dependent = await prisma.organization.create({
        data: {
          name: `${key}-dependent`,
          slug: `${key}-dependent`,
          type: 'PROMOTER',
          status: 'ACTIVE',
        },
      });
      const dependentOwner = await registerUser(app, {
        role: 'OWNER',
        email: `${key}-dep-owner@test.invalid`,
      });
      await prisma.user.update({
        where: { id: dependentOwner.user.id },
        data: { organizationId: dependent.id, isPlatformAdmin: false },
      });
      const venue = await prisma.venue.create({
        data: {
          organizationId: dependent.id,
          name: `${key}-venue`,
          address: { city: 'St. Johns' },
          capacity: 100,
          timezone: 'America/St_Johns',
        },
      });

      const withVenue = await request(app)
        .delete(`/api/v1/organizations/${dependent.id}`)
        .set(auth(dependentOwner.accessToken));
      expect(withVenue.status).toBe(400);
      expect(withVenue.body.message).toBe(
        'Cannot delete organization with existing events or venues'
      );

      await prisma.event.create({
        data: {
          organizationId: dependent.id,
          venueId: venue.id,
          name: `${key}-event`,
          slug: `${key}-event`,
          description: 'dependent event',
          startDatetime: new Date(Date.now() + 86400000),
          endDatetime: new Date(Date.now() + 90000000),
          status: 'DRAFT',
          capacity: 50,
          timezone: 'America/St_Johns',
          tags: [],
        },
      });
      const withEvent = await request(app)
        .delete(`/api/v1/organizations/${dependent.id}`)
        .set(auth(dependentOwner.accessToken));
      expect(withEvent.status).toBe(400);
      expect(await prisma.organization.findUnique({ where: { id: dependent.id } })).not.toBeNull();
    });

    it('blocks a non-owner member from deleting the organization', async () => {
      const response = await request(app)
        .delete(`/api/v1/organizations/${orgId}`)
        .set(auth(managerToken));
      expect(response.status).toBe(403);
      expect(await prisma.organization.findUnique({ where: { id: orgId } })).not.toBeNull();
    });
  });
});
