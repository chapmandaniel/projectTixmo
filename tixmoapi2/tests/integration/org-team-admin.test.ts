import { randomUUID } from 'crypto';
import request from 'supertest';

jest.mock('../../src/config/email', () => ({
  transporter: { sendMail: jest.fn().mockResolvedValue({}) },
  emailFrom: { name: 'Tixmo', address: 'local-test@example.com' },
}));

import app from '../../src/app';
import { prisma, registerUser } from '../utils/testUtils';
import { LAST_OWNER_GUARD_MESSAGE } from '../../src/utils/organizationOwnership';

describe('Organization last-owner protection', () => {
  const key = `org-team-admin-${randomUUID()}`.slice(0, 40);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: key } } });
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createOrg = (suffix: string) =>
    prisma.organization.create({
      data: {
        name: `${key}-${suffix}`,
        slug: `${key}-${suffix}`,
        type: 'PROMOTER',
        status: 'ACTIVE',
      },
    });

  const attachOwner = async (orgId: string, suffix: string) => {
    const created = await registerUser(app, {
      role: 'OWNER',
      email: `${key}-${suffix}@test.invalid`,
    });
    await prisma.user.update({
      where: { id: created.user.id },
      data: { organizationId: orgId, role: 'OWNER', isPlatformAdmin: false },
    });
    return created;
  };

  describe('last-owner protection', () => {
    it('refuses to remove the last OWNER from an organization', async () => {
      const solo = await prisma.organization.create({
        data: { name: `${key}-solo`, slug: `${key}-solo`, type: 'PROMOTER', status: 'ACTIVE' },
      });
      const soloOwner = await registerUser(app, {
        role: 'OWNER',
        email: `${key}-solo-owner@test.invalid`,
      });
      await prisma.user.update({
        where: { id: soloOwner.user.id },
        data: { organizationId: solo.id, role: 'OWNER', isPlatformAdmin: false },
      });

      const removed = await request(app)
        .delete(`/api/v1/organizations/${solo.id}/members/${soloOwner.user.id}`)
        .set(auth(soloOwner.accessToken));

      expect(removed.status).toBe(400);
      expect(removed.body.message).toBe(LAST_OWNER_GUARD_MESSAGE);
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: soloOwner.user.id } })
      ).toMatchObject({
        organizationId: solo.id,
        role: 'OWNER',
      });
    });

    it('lets a second OWNER be removed while the remaining owner stays', async () => {
      const org = await createOrg('pair');
      const remaining = await attachOwner(org.id, 'pair-remaining');
      const departing = await attachOwner(org.id, 'pair-departing');

      const removed = await request(app)
        .delete(`/api/v1/organizations/${org.id}/members/${departing.user.id}`)
        .set(auth(remaining.accessToken));

      expect(removed.status).toBe(200);
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: departing.user.id } })
      ).toMatchObject({
        organizationId: null,
        role: 'CUSTOMER',
      });
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: remaining.user.id } })
      ).toMatchObject({
        organizationId: org.id,
        role: 'OWNER',
      });
    });

    it('refuses to demote the last OWNER and still allows demoting a non-last owner', async () => {
      const org = await createOrg('demote');
      const lastOwner = await attachOwner(org.id, 'demote-last');
      const otherOwner = await attachOwner(org.id, 'demote-other');
      const globalOwner = await registerUser(app, {
        role: 'OWNER',
        email: `${key}-demote-global@test.invalid`,
      });
      await prisma.user.update({
        where: { id: globalOwner.user.id },
        data: { organizationId: null, role: 'OWNER', isPlatformAdmin: false },
      });

      const demotedOther = await request(app)
        .put(`/api/v1/users/${otherOwner.user.id}`)
        .set(auth(lastOwner.accessToken))
        .send({ role: 'ADMIN' });
      expect(demotedOther.status).toBe(200);
      expect(demotedOther.body.data.role).toBe('ADMIN');
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: otherOwner.user.id } })
      ).toMatchObject({
        role: 'ADMIN',
        organizationId: org.id,
      });

      const demotedLast = await request(app)
        .put(`/api/v1/users/${lastOwner.user.id}`)
        .set(auth(globalOwner.accessToken))
        .send({ role: 'ADMIN' });
      expect(demotedLast.status).toBe(400);
      expect(demotedLast.body.message).toBe(LAST_OWNER_GUARD_MESSAGE);
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: lastOwner.user.id } })
      ).toMatchObject({
        organizationId: org.id,
        role: 'OWNER',
      });
    });

    it('still lets an owner remove a non-owner member', async () => {
      const org = await createOrg('member');
      const owner = await attachOwner(org.id, 'member-owner');
      const member = await registerUser(app, {
        email: `${key}-member-staff@test.invalid`,
      });
      await prisma.user.update({
        where: { id: member.user.id },
        data: { organizationId: org.id, role: 'TEAM_MEMBER', isPlatformAdmin: false },
      });

      const removed = await request(app)
        .delete(`/api/v1/organizations/${org.id}/members/${member.user.id}`)
        .set(auth(owner.accessToken));

      expect(removed.status).toBe(200);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: member.user.id } })).toMatchObject({
        organizationId: null,
        role: 'CUSTOMER',
      });
      expect(await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).toMatchObject({
        organizationId: org.id,
        role: 'OWNER',
      });
    });
  });
});
