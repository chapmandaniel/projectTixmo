import { randomUUID } from 'crypto';
import request from 'supertest';

jest.mock('../../src/config/email', () => ({
  transporter: { sendMail: jest.fn().mockResolvedValue({}) },
  emailFrom: { name: 'Tixmo', address: 'local-test@example.com' },
}));

import app from '../../src/app';
import { prisma, registerUser } from '../utils/testUtils';
import { transporter } from '../../src/config/email';
import { LAST_OWNER_GUARD_MESSAGE } from '../../src/utils/organizationOwnership';

describe('Organization team administration', () => {
  const key = `org-team-admin-${randomUUID()}`.slice(0, 40);
  let orgId = '';
  let owner: { user: { id: string }; accessToken: string };
  let admin: { user: { id: string }; accessToken: string };
  let manager: { user: { id: string }; accessToken: string };
  let promoter: { user: { id: string }; accessToken: string };
  let teamMember: { user: { id: string }; accessToken: string };
  let customer: { user: { id: string }; accessToken: string };

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `${key}-org`, slug: `${key}-org`, type: 'PROMOTER', status: 'ACTIVE' },
    });
    orgId = org.id;

    const attach = async (
      email: string,
      role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'PROMOTER' | 'TEAM_MEMBER' | 'CUSTOMER',
      permissions?: Record<string, boolean>
    ) => {
      const created =
        role === 'CUSTOMER'
          ? await registerUser(app, { email })
          : await registerUser(app, { email, role });
      await prisma.user.update({
        where: { id: created.user.id },
        data: {
          organizationId: orgId,
          role,
          isPlatformAdmin: false,
          ...(permissions ? { permissions } : {}),
        },
      });
      return created;
    };

    owner = await attach(`${key}-owner@test.invalid`, 'OWNER');
    admin = await attach(`${key}-admin@test.invalid`, 'ADMIN');
    manager = await attach(`${key}-manager@test.invalid`, 'MANAGER');
    promoter = await attach(`${key}-promoter@test.invalid`, 'PROMOTER');
    teamMember = await attach(`${key}-member@test.invalid`, 'TEAM_MEMBER', {
      manageEvents: true,
      viewAnalytics: true,
      manageTickets: true,
      manageTeam: true,
      scanTickets: true,
    });
    customer = await registerUser(app, { email: `${key}-customer@test.invalid` });
  });

  afterAll(async () => {
    await prisma.staffInvitation.deleteMany({
      where: { user: { email: { startsWith: key } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: key } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: key } } });
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('invite', () => {
    it('lets an owner invite a team member and records a pending invitation', async () => {
      (transporter.sendMail as jest.Mock).mockClear();
      const email = `${key}-invited@test.invalid`;
      const response = await request(app)
        .post('/api/v1/users')
        .set(auth(owner.accessToken))
        .send({
          email,
          firstName: 'Invited',
          lastName: 'Member',
          role: 'TEAM_MEMBER',
          permissions: { manageEvents: true },
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        email,
        role: 'TEAM_MEMBER',
        organizationId: orgId,
        invitationPending: true,
        invitationDelivered: true,
        permissions: { manageEvents: true },
      });
      expect(transporter.sendMail).toHaveBeenCalled();
      const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(stored.organizationId).toBe(orgId);
      expect(stored.disabledAt).not.toBeNull();
    });

    it('blocks a TEAM_MEMBER, including one with manageTeam, from inviting', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .set(auth(teamMember.accessToken))
        .send({
          email: `${key}-blocked-invite@test.invalid`,
          firstName: 'Blocked',
          lastName: 'Invite',
          role: 'TEAM_MEMBER',
        });
      expect(response.status).toBe(403);
      expect(
        await prisma.user.findUnique({ where: { email: `${key}-blocked-invite@test.invalid` } })
      ).toBeNull();
    });
  });

  describe('add and remove members', () => {
    it('lets an owner add an unaffiliated user and then remove them', async () => {
      const recruit = await registerUser(app, { email: `${key}-recruit@test.invalid` });

      const added = await request(app)
        .post(`/api/v1/organizations/${orgId}/members`)
        .set(auth(owner.accessToken))
        .send({ userId: recruit.user.id });
      expect(added.status).toBe(200);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: recruit.user.id } })).toMatchObject(
        {
          organizationId: orgId,
        }
      );

      const removed = await request(app)
        .delete(`/api/v1/organizations/${orgId}/members/${recruit.user.id}`)
        .set(auth(owner.accessToken));
      expect(removed.status).toBe(200);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: recruit.user.id } })).toMatchObject(
        {
          organizationId: null,
          role: 'CUSTOMER',
        }
      );
    });

    it('blocks a manager, promoter, team member, and customer from adding or removing members', async () => {
      const recruit = await registerUser(app, { email: `${key}-gated-recruit@test.invalid` });
      const actors = [
        manager.accessToken,
        promoter.accessToken,
        teamMember.accessToken,
        customer.accessToken,
      ];

      for (const token of actors) {
        const added = await request(app)
          .post(`/api/v1/organizations/${orgId}/members`)
          .set(auth(token))
          .send({ userId: recruit.user.id });
        expect(added.status).toBe(403);
        expect(
          await prisma.user.findUniqueOrThrow({ where: { id: recruit.user.id } })
        ).toMatchObject({ organizationId: null });
      }

      await prisma.user.update({
        where: { id: recruit.user.id },
        data: { organizationId: orgId, role: 'TEAM_MEMBER' },
      });

      for (const token of actors) {
        const removed = await request(app)
          .delete(`/api/v1/organizations/${orgId}/members/${recruit.user.id}`)
          .set(auth(token));
        expect(removed.status).toBe(403);
      }
      expect(await prisma.user.findUniqueOrThrow({ where: { id: recruit.user.id } })).toMatchObject(
        {
          organizationId: orgId,
          role: 'TEAM_MEMBER',
        }
      );
    });
  });

  describe('change roles', () => {
    it('lets an owner change a member role and persists the new role', async () => {
      const target = await registerUser(app, { email: `${key}-role-target@test.invalid` });
      await prisma.user.update({
        where: { id: target.user.id },
        data: { organizationId: orgId, role: 'TEAM_MEMBER', isPlatformAdmin: false },
      });

      const updated = await request(app)
        .put(`/api/v1/users/${target.user.id}`)
        .set(auth(owner.accessToken))
        .send({ role: 'PROMOTER' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.role).toBe('PROMOTER');
      expect(await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } })).toMatchObject({
        role: 'PROMOTER',
        organizationId: orgId,
      });
    });

    it('lets an admin downgrade a lower role and refuses promoting to ADMIN', async () => {
      const target = await registerUser(app, { email: `${key}-admin-target@test.invalid` });
      await prisma.user.update({
        where: { id: target.user.id },
        data: { organizationId: orgId, role: 'PROMOTER', isPlatformAdmin: false },
      });

      const downgraded = await request(app)
        .put(`/api/v1/users/${target.user.id}`)
        .set(auth(admin.accessToken))
        .send({ role: 'TEAM_MEMBER' });
      expect(downgraded.status).toBe(200);
      expect(downgraded.body.data.role).toBe('TEAM_MEMBER');

      const escalate = await request(app)
        .put(`/api/v1/users/${target.user.id}`)
        .set(auth(admin.accessToken))
        .send({ role: 'ADMIN' });
      expect(escalate.status).toBe(403);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } })).toMatchObject({
        role: 'TEAM_MEMBER',
      });
    });

    it('blocks a TEAM_MEMBER from changing another member’s role', async () => {
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: promoter.user.id },
        select: { role: true, organizationId: true },
      });
      const response = await request(app)
        .put(`/api/v1/users/${promoter.user.id}`)
        .set(auth(teamMember.accessToken))
        .send({ role: 'CUSTOMER' });
      expect(response.status).toBe(403);
      expect(
        await prisma.user.findUniqueOrThrow({
          where: { id: promoter.user.id },
          select: { role: true, organizationId: true },
        })
      ).toEqual(before);
    });
  });

  describe('role and permission gates', () => {
    it('refuses a TEAM_MEMBER with stored manageEvents/viewAnalytics/manageTeam flags on those APIs', async () => {
      const createEvent = await request(app)
        .post('/api/v1/events')
        .set(auth(teamMember.accessToken))
        .send({
          title: `${key} Event`,
          organizationId: orgId,
          startDateTime: new Date(Date.now() + 86400000).toISOString(),
          endDateTime: new Date(Date.now() + 90000000).toISOString(),
        });
      expect(createEvent.status).toBe(403);

      const analytics = await request(app)
        .get(`/api/v1/analytics/sales?organizationId=${orgId}`)
        .set(auth(teamMember.accessToken));
      expect(analytics.status).toBe(403);

      const invite = await request(app)
        .post('/api/v1/users')
        .set(auth(teamMember.accessToken))
        .send({
          email: `${key}-flag-invite@test.invalid`,
          firstName: 'Flag',
          lastName: 'Invite',
          role: 'SCANNER',
        });
      expect(invite.status).toBe(403);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: teamMember.user.id },
        select: { permissions: true, role: true },
      });
      expect(stored.role).toBe('TEAM_MEMBER');
      expect(stored.permissions).toMatchObject({
        manageEvents: true,
        viewAnalytics: true,
        manageTeam: true,
      });
    });

    it('blocks a customer from listing team members', async () => {
      const response = await request(app)
        .get(`/api/v1/users?organizationId=${orgId}`)
        .set(auth(customer.accessToken));
      expect(response.status).toBe(403);
    });
  });
});

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
