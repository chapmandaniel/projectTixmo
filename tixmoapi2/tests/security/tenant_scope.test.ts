import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, createOrganization, prisma, registerUser } from '../utils/testUtils';

const PASSWORD = 'SecurePass123!';

async function createScopedPromoter(organizationId: string, email: string) {
  const registered = await registerUser(app, {
    email,
    password: PASSWORD,
  });

  await prisma.user.update({
    where: { id: registered.user.id },
    data: {
      role: 'PROMOTER',
      organizationId,
    },
  });

  const login = await request(app).post('/api/v1/auth/login').send({
    email,
    password: PASSWORD,
  });

  expect(login.status).toBe(200);
  return login.body.data.accessToken as string;
}

describe('Security: tenant-scoped resource access', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('blocks an org-scoped promoter from creating an event in another organization', async () => {
    const orgA = await createOrganization(app, '', { name: 'Scope Org A', slug: 'scope-org-a' });
    const orgB = await createOrganization(app, '', { name: 'Scope Org B', slug: 'scope-org-b' });
    const token = await createScopedPromoter(orgA.id, 'scope-promoter-a@example.com');

    const response = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        organizationId: orgB.id,
        title: 'Cross Tenant Event',
        description: 'Should not be allowed',
        startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endDateTime: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
      });

    expect(response.status).toBe(403);
  });

  it('blocks an org-scoped promoter from reading another organization profile', async () => {
    const orgA = await createOrganization(app, '', {
      name: 'Profile Org A',
      slug: 'profile-org-a',
    });
    const orgB = await createOrganization(app, '', {
      name: 'Profile Org B',
      slug: 'profile-org-b',
    });
    const token = await createScopedPromoter(orgA.id, 'scope-promoter-b@example.com');

    const response = await request(app)
      .get(`/api/v1/organizations/${orgB.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('blocks an org-scoped promoter from querying analytics for another organization', async () => {
    const orgA = await createOrganization(app, '', {
      name: 'Analytics Org A',
      slug: 'analytics-org-a',
    });
    const orgB = await createOrganization(app, '', {
      name: 'Analytics Org B',
      slug: 'analytics-org-b',
    });
    const token = await createScopedPromoter(orgA.id, 'scope-promoter-c@example.com');

    const response = await request(app)
      .get(`/api/v1/analytics/events?organizationId=${orgB.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });
});
