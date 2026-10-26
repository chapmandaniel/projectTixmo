import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { eventService } from '../../src/api/events/service';
import { scannerService } from '../../src/api/scanners/service';
import { createOrganization, registerUser } from '../utils/testUtils';

describe('staff action audit', () => {
  const emails: string[] = [];

  afterAll(async () => {
    await prisma.staffActionAudit.deleteMany();
    if (emails.length) await prisma.user.deleteMany({ where: { email: { in: emails } } });
  });

  test('OWNER and ADMIN can read actor, reason, and time; MANAGER cannot', async () => {
    const ownerEmail = `staff-audit-owner-${randomUUID()}@example.com`;
    emails.push(ownerEmail);
    const owner = await registerUser(app, { role: 'OWNER', email: ownerEmail });
    const org = await createOrganization(app, owner.accessToken, {
      name: 'Staff audit',
      slug: `staff-audit-${randomUUID()}`,
    });
    const event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: 'Audit night',
        slug: randomUUID(),
        status: 'DRAFT',
        tags: [],
      },
    });
    await eventService.updateEvent(event.id, { description: 'Door note' }, undefined, {
      actorId: owner.user.id,
      reason: 'Fix the door copy',
    });
    await prisma.event.update({ where: { id: event.id }, data: { status: 'PUBLISHED' } });
    await eventService.cancelEvent(event.id, { actorId: owner.user.id, reason: 'Weather' });
    const scanner = await prisma.scanner.create({
      data: {
        name: 'Gate',
        apiKey: randomUUID(),
        organizationId: org.id,
        createdBy: owner.user.id,
      },
    });
    await scannerService.deleteScanner(scanner.id, {
      actorId: owner.user.id,
      reason: 'Lost phone',
    });

    const ownerList = await request(app)
      .get('/api/v1/staff-actions')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(ownerList.status).toBe(200);
    const rows = ownerList.body.data as Array<{
      action: string;
      actorId: string;
      reason: string;
      createdAt: string;
    }>;
    expect(rows.map((row) => row.action).sort()).toEqual([
      'EVENT_CANCEL',
      'EVENT_EDIT',
      'SCANNER_REVOKE',
    ]);
    const edit = rows.find((row) => row.action === 'EVENT_EDIT');
    expect(edit).toMatchObject({ actorId: owner.user.id, reason: 'Fix the door copy' });
    expect(edit?.createdAt).toEqual(expect.any(String));
    expect(rows.find((row) => row.action === 'EVENT_CANCEL')?.reason).toBe('Weather');
    expect(rows.find((row) => row.action === 'SCANNER_REVOKE')?.reason).toBe('Lost phone');

    const managerEmail = `staff-audit-manager-${randomUUID()}@example.com`;
    emails.push(managerEmail);
    const manager = await registerUser(app, { role: 'MANAGER', email: managerEmail });
    await prisma.user.update({
      where: { id: manager.user.id },
      data: { organizationId: org.id },
    });
    const denied = await request(app)
      .get('/api/v1/staff-actions')
      .set('Authorization', `Bearer ${manager.accessToken}`);
    expect(denied.status).toBe(403);

    const foreignEmail = `staff-audit-foreign-${randomUUID()}@example.com`;
    emails.push(foreignEmail);
    const foreign = await registerUser(app, { role: 'OWNER', email: foreignEmail });
    await createOrganization(app, foreign.accessToken, {
      name: 'Other audit',
      slug: `other-audit-${randomUUID()}`,
    });
    const hidden = await request(app)
      .get('/api/v1/staff-actions')
      .set('Authorization', `Bearer ${foreign.accessToken}`);
    expect(hidden.status).toBe(200);
    expect(hidden.body.data).toEqual([]);

    const adminEmail = `staff-audit-admin-${randomUUID()}@example.com`;
    emails.push(adminEmail);
    const admin = await registerUser(app, { role: 'ADMIN', email: adminEmail });
    const adminList = await request(app)
      .get('/api/v1/staff-actions')
      .query({ organizationId: org.id })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.data).toHaveLength(3);
  });
});
