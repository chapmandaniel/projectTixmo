import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { registerUser } from '../utils/testUtils';

describe('organization admin visibility', () => {
  const key = `org-visibility-${randomUUID()}`;
  let ownOrgId = '';
  let otherOrgId = '';
  let orgAdminToken = '';
  let orgAdminId = '';
  let globalToken = '';
  let colleagueId = '';
  let outsiderId = '';

  beforeAll(async () => {
    const orgAdmin = await registerUser(app, {
      role: 'ADMIN',
      email: `${key}-admin@test.invalid`,
    });
    orgAdminToken = orgAdmin.accessToken;
    orgAdminId = orgAdmin.user.id;
    const globalAdmin = await registerUser(app, {
      role: 'ADMIN',
      email: `${key}-platform@test.invalid`,
    });
    globalToken = globalAdmin.accessToken;

    const own = await prisma.organization.create({
      data: { name: `${key}-own`, slug: `${key}-own`, type: 'PROMOTER' },
    });
    const other = await prisma.organization.create({
      data: { name: `${key}-other`, slug: `${key}-other`, type: 'PROMOTER' },
    });
    ownOrgId = own.id;
    otherOrgId = other.id;
    await prisma.user.update({
      where: { id: orgAdminId },
      data: { organizationId: ownOrgId, isPlatformAdmin: false },
    });
    const colleague = await registerUser(app, { email: `${key}-colleague@test.invalid` });
    colleagueId = colleague.user.id;
    await prisma.user.update({
      where: { id: colleagueId },
      data: { organizationId: ownOrgId },
    });
    const outsider = await registerUser(app, { email: `${key}-outsider@test.invalid` });
    outsiderId = outsider.user.id;
    await prisma.user.update({
      where: { id: outsiderId },
      data: { organizationId: otherOrgId },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: key } } });
    await prisma.$disconnect();
  });

  const ids = (body: {
    data?: { organizations?: Array<{ id: string }>; users?: Array<{ id: string }> };
  }) => (body.data?.organizations || body.data?.users || []).map((row) => row.id);

  it('lists and looks up only the org admin’s organization', async () => {
    const listed = await request(app)
      .get('/api/v1/organizations?limit=50')
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(listed.status).toBe(200);
    expect(ids(listed.body)).toEqual([ownOrgId]);

    const own = await request(app)
      .get(`/api/v1/organizations/${ownOrgId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(own.status).toBe(200);
    expect(own.body.data.id).toBe(ownOrgId);

    const other = await request(app)
      .get(`/api/v1/organizations/${otherOrgId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(other.status).toBe(403);
    expect(other.body.data).toBeUndefined();
  });

  it('lists and looks up only the org admin’s users', async () => {
    const listed = await request(app)
      .get(`/api/v1/users?limit=50&organizationId=${otherOrgId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(listed.status).toBe(200);
    const listedIds = ids(listed.body);
    expect(listedIds).toContain(orgAdminId);
    expect(listedIds).toContain(colleagueId);
    expect(listedIds).not.toContain(outsiderId);

    const colleague = await request(app)
      .get(`/api/v1/users/${colleagueId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(colleague.status).toBe(200);
    expect(colleague.body.data.organizationId).toBe(ownOrgId);

    const outsider = await request(app)
      .get(`/api/v1/users/${outsiderId}`)
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(outsider.status).toBe(403);

    const missing = await request(app)
      .get(`/api/v1/users/${randomUUID()}`)
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(missing.status).toBe(404);
  });

  it('lets a global platform admin see every organization and user', async () => {
    const listed = await request(app)
      .get('/api/v1/organizations?limit=200')
      .set('Authorization', `Bearer ${globalToken}`);
    expect(listed.status).toBe(200);
    const listedIds = ids(listed.body);
    expect(listedIds).toContain(ownOrgId);
    expect(listedIds).toContain(otherOrgId);

    const other = await request(app)
      .get(`/api/v1/organizations/${otherOrgId}`)
      .set('Authorization', `Bearer ${globalToken}`);
    expect(other.status).toBe(200);

    const users = await request(app)
      .get(`/api/v1/users?limit=50&organizationId=${otherOrgId}`)
      .set('Authorization', `Bearer ${globalToken}`);
    expect(users.status).toBe(200);
    expect(ids(users.body)).toContain(outsiderId);
    expect(ids(users.body)).not.toContain(colleagueId);

    const outsider = await request(app)
      .get(`/api/v1/users/${outsiderId}`)
      .set('Authorization', `Bearer ${globalToken}`);
    expect(outsider.status).toBe(200);
    expect(outsider.body.data.organizationId).toBe(otherOrgId);
  });
});
