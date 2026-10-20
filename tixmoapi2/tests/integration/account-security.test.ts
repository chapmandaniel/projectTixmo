import crypto from 'crypto';
import { spawnSync } from 'child_process';
import path from 'path';
import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, prisma, registerUser } from '../utils/testUtils';
import { transporter } from '../../src/config/email';
import { userService } from '../../src/api/users/service';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config/environment';

jest.mock('../../src/config/email', () => ({
  transporter: { sendMail: jest.fn().mockResolvedValue({}) },
  emailFrom: { name: 'Tixmo', address: 'local-test@example.com' },
}));

describe('Account revocation and invitation boundaries', () => {
  const password = 'SecurePass123!';
  let owner: any;
  let organizationId: string;
  beforeEach(async () => {
    await cleanupTestData();
    jest.clearAllMocks();
    owner = await registerUser(app, { email: 'test-security-owner@example.com', role: 'OWNER' });
    const org = await prisma.organization.create({
      data: { name: 'Security test', slug: 'security-test', type: 'PROMOTER', status: 'ACTIVE' },
    });
    organizationId = org.id;
    await prisma.user.update({ where: { id: owner.user.id }, data: { organizationId } });
  });
  afterAll(cleanupTestData);

  async function invite(email = 'test-invited@example.com') {
    const response = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email, firstName: 'Invited', lastName: 'Staff', role: 'TEAM_MEMBER' })
      .expect(201);
    const mail = (transporter.sendMail as jest.Mock).mock.calls.at(-1)![0];
    const token = mail.text.match(/\/invite#([a-f0-9]{64})/)![1];
    expect(mail.text).not.toContain('Temporary Password:');
    return { id: response.body.data.id, token };
  }

  it('rejects deleted account access, refresh and former-password login', async () => {
    const target = await registerUser(app, { email: 'test-delete@example.com', role: 'ADMIN' });
    await request(app)
      .delete(`/api/v1/users/${target.user.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(403);
    await prisma.user.update({
      where: { id: target.user.id },
      data: { role: 'TEAM_MEMBER', organizationId },
    });
    await request(app)
      .delete(`/api/v1/users/${target.user.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(204);
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${target.accessToken}`)
      .expect(401);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: target.refreshToken })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `deleted_${target.user.id}@deleted.com`, password })
      .expect(401);
  });

  it('revokes both token types on demotion and allows the new customer session', async () => {
    const target = await registerUser(app, { email: 'test-demote@example.com', role: 'MANAGER' });
    await prisma.user.update({ where: { id: target.user.id }, data: { organizationId } });
    await request(app)
      .put(`/api/v1/users/${target.user.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'CUSTOMER' })
      .expect(200);
    await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${target.accessToken}`)
      .expect(401);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: target.refreshToken })
      .expect(401);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: target.user.email, password })
      .expect(200);
    expect(login.body.data.user.role).toBe('CUSTOMER');
    expect(login.body.data.user.organizationId).toBeNull();
    await request(app)
      .get('/api/v1/approvals')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(403);
    await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(403);
  });

  it('offboards ADMIN without turning it into global authority', async () => {
    const target = await registerUser(app, { email: 'test-offboard@example.com', role: 'ADMIN' });
    await prisma.user.update({ where: { id: target.user.id }, data: { organizationId } });
    await request(app)
      .delete(`/api/v1/organizations/${organizationId}/members/${target.user.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } });
    expect(user.role).toBe('CUSTOMER');
    expect(user.organizationId).toBeNull();
    await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${target.accessToken}`)
      .expect(401);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: target.refreshToken })
      .expect(401);
  });

  it('does not grant platform identity after business deletion or a forged role claim', async () => {
    const target = await registerUser(app, {
      email: 'test-orphan-admin@example.com',
      role: 'ADMIN',
    });
    const emptyBusiness = await prisma.organization.create({
      data: { name: 'Empty', slug: 'empty-business', type: 'PROMOTER' },
    });
    await prisma.user.update({
      where: { id: target.user.id },
      data: { organizationId: emptyBusiness.id, isPlatformAdmin: false },
    });
    await prisma.organization.delete({ where: { id: emptyBusiness.id } });
    await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${target.accessToken}`)
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: target.user.email, password })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: target.refreshToken })
      .expect(401);
    const customer = await registerUser(app, { email: 'test-claim-customer@example.com' });
    const forged = jwt.sign(
      { userId: customer.user.id, role: 'ADMIN', sessionVersion: 0 },
      config.jwtSecret
    );
    await request(app).get('/api/v1/users').set('Authorization', `Bearer ${forged}`).expect(403);
  });

  it('revokes both token types on logout, including tokens minted in the same second', async () => {
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(401);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: owner.refreshToken })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: owner.user.email, password })
      .expect(200);
  });

  it('rejects legacy claims without a session version', async () => {
    const token = jwt.sign(
      { userId: owner.user.id, role: 'OWNER', email: owner.user.email },
      config.jwtSecret
    );
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('accepts one invitation once with stored authority and only its hashed token', async () => {
    const invitation = await invite();
    const stored = await prisma.staffInvitation.findFirstOrThrow({
      where: { userId: invitation.id },
    });
    expect(stored.tokenHash).toBe(
      crypto.createHash('sha256').update(invitation.token).digest('hex')
    );
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test-invited@example.com', password })
      .expect(401);
    const result = await request(app)
      .post('/api/v1/auth/accept-invitation')
      .send({
        token: invitation.token,
        password,
        role: 'OWNER',
        organizationId: null,
        email: 'other@example.com',
      })
      .expect(200);
    expect(result.body.data.user.role).toBe('TEAM_MEMBER');
    expect(result.body.data.user.organizationId).toBe(organizationId);
    expect(result.body.data.user.email).toBe('test-invited@example.com');
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${result.body.data.accessToken}`)
      .expect(200);
    await request(app)
      .post('/api/v1/auth/accept-invitation')
      .send({ token: invitation.token, password })
      .expect(401);
  });

  it('allows only one concurrent invitation redemption', async () => {
    const invitation = await invite();
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app)
          .post('/api/v1/auth/accept-invitation')
          .send({ token: invitation.token, password })
      )
    );
    expect(responses.map((res) => res.status).sort()).toEqual([200, 401]);
  });

  it('rejects expired, random and malformed invitations', async () => {
    const invitation = await invite();
    await prisma.staffInvitation.updateMany({
      where: { userId: invitation.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    for (const token of [invitation.token, crypto.randomBytes(32).toString('hex')]) {
      await request(app)
        .post('/api/v1/auth/accept-invitation')
        .send({ token, password })
        .expect(401);
    }
    await request(app)
      .post('/api/v1/auth/accept-invitation')
      .send({ token: 'bad', password })
      .expect(400);
  });

  it('recovers an expired invitation and invalidates the previous link', async () => {
    const invitation = await invite();
    await prisma.staffInvitation.updateMany({
      where: { userId: invitation.id },
      data: { expiresAt: new Date(0) },
    });
    const listed = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(listed.body.data.users.find((u: any) => u.id === invitation.id).invitationPending).toBe(
      true
    );
    await request(app)
      .post(`/api/v1/users/${invitation.id}/invitation`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const token = (transporter.sendMail as jest.Mock).mock.calls
      .at(-1)![0]
      .text.match(/\/invite#([a-f0-9]{64})/)![1];
    expect(token).not.toBe(invitation.token);
    await request(app)
      .post('/api/v1/auth/accept-invitation')
      .send({ token: invitation.token, password })
      .expect(401);
    await request(app).post('/api/v1/auth/accept-invitation').send({ token, password }).expect(200);
    await request(app)
      .post(`/api/v1/users/${invitation.id}/invitation`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);
  });

  it('reports email delivery failures and allows a safe retry', async () => {
    (transporter.sendMail as jest.Mock).mockRejectedValueOnce(new Error('Local delivery failure'));
    const created = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        email: 'test-delivery@example.com',
        firstName: 'Pending',
        lastName: 'Staff',
        role: 'TEAM_MEMBER',
      })
      .expect(201);
    expect(created.body.data.invitationDelivered).toBe(false);
    (transporter.sendMail as jest.Mock).mockRejectedValueOnce(new Error('Local delivery failure'));
    await request(app)
      .post(`/api/v1/users/${created.body.data.id}/invitation`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(500);
    await request(app)
      .post(`/api/v1/users/${created.body.data.id}/invitation`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const token = (transporter.sendMail as jest.Mock).mock.calls
      .at(-1)![0]
      .text.match(/\/invite#([a-f0-9]{64})/)![1];
    await request(app).post('/api/v1/auth/accept-invitation').send({ token, password }).expect(200);
  });

  it('restricts invitation recovery by role, organization and account state', async () => {
    const invitation = await invite();
    const customer = await registerUser(app, { email: 'test-resend-customer@example.com' });
    await request(app)
      .post(`/api/v1/users/${invitation.id}/invitation`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .expect(403);
    const other = await registerUser(app, {
      email: 'test-resend-manager@example.com',
      role: 'MANAGER',
    });
    const otherOrg = await prisma.organization.create({
      data: { name: 'Other', slug: 'other-resend', type: 'PROMOTER' },
    });
    await prisma.user.update({
      where: { id: other.user.id },
      data: { organizationId: otherOrg.id },
    });
    await request(app)
      .post(`/api/v1/users/${invitation.id}/invitation`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(403);
    await prisma.user.update({ where: { id: invitation.id }, data: { role: 'OWNER' } });
    await prisma.user.update({ where: { id: other.user.id }, data: { organizationId } });
    await request(app)
      .post(`/api/v1/users/${invitation.id}/invitation`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(403);
    await userService.deleteUser(invitation.id);
    await request(app)
      .post(`/api/v1/users/${invitation.id}/invitation`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(403);
  });

  it.each(['delete', 'demote', 'issuer-offboard'])(
    'does not reactivate an invitation after %s',
    async (change) => {
      const invitation = await invite();
      if (change === 'delete') await userService.deleteUser(invitation.id);
      if (change === 'demote') await userService.updateUser(invitation.id, { role: 'CUSTOMER' });
      if (change === 'issuer-offboard')
        await userService.updateUser(owner.user.id, { organizationId: null });
      const result = await request(app)
        .post('/api/v1/auth/accept-invitation')
        .send({ token: invitation.token, password });
      expect([401, 403]).toContain(result.status);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: invitation.id } })).disabledAt
      ).not.toBeNull();
    }
  );

  it('keeps legacy automatic seed commands harmless in production', () => {
    const result = spawnSync(process.execPath, ['prisma/seed-minimal.js'], {
      cwd: path.resolve(__dirname, '../..'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://invalid.invalid/unused',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Automatic account seeding is disabled');
    expect(result.stdout).not.toMatch(/password|@/i);
  });
});
