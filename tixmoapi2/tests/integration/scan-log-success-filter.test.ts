import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { generateAccessToken } from '../../src/utils/jwt';

describe('GET /scanners/logs success filter', () => {
  const key = `scan-filter-${randomUUID()}`;
  let organizationId = '';
  let scannerId = '';
  let token = '';

  beforeAll(async () => {
    const organization = await prisma.organization.create({
      data: { name: key, slug: key, type: 'PROMOTER' },
    });
    organizationId = organization.id;
    const owner = await prisma.user.create({
      data: {
        email: `${key}@test.invalid`,
        passwordHash: 'test-only',
        firstName: 'Scan',
        lastName: 'Owner',
        role: 'OWNER',
        organizationId,
      },
    });
    token = generateAccessToken({
      userId: owner.id,
      email: owner.email,
      role: owner.role,
      organizationId,
      sessionVersion: 0,
    });
    const scanner = await prisma.scanner.create({
      data: {
        name: 'Gate',
        apiKey: `sk_${key}`,
        organizationId,
        createdBy: owner.id,
      },
    });
    scannerId = scanner.id;
    await prisma.scanLog.createMany({
      data: [
        { scannerId, success: true, scanType: 'ENTRY' },
        { scannerId, success: false, scanType: 'ENTRY', failureReason: 'denied' },
        { scannerId, success: false, scanType: 'ENTRY', failureReason: 'void' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({ where: { scannerId } });
    await prisma.scanner.deleteMany({ where: { id: scannerId } });
    await prisma.user.deleteMany({ where: { email: `${key}@test.invalid` } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it('returns only failures when success=false', async () => {
    const failures = await request(app)
      .get('/api/v1/scanners/logs?success=false')
      .set('Authorization', `Bearer ${token}`);
    expect(failures.status).toBe(200);
    const failed = failures.body.data as Array<{ success: boolean }>;
    expect(failed.length).toBe(2);
    expect(failed.every((row) => row.success === false)).toBe(true);

    const successes = await request(app)
      .get('/api/v1/scanners/logs?success=true')
      .set('Authorization', `Bearer ${token}`);
    expect(successes.status).toBe(200);
    const passed = successes.body.data as Array<{ success: boolean }>;
    expect(passed.length).toBe(1);
    expect(passed.every((row) => row.success === true)).toBe(true);
  });
});
