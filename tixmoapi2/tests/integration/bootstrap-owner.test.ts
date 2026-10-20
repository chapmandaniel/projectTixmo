import { cleanupTestData, prisma } from '../utils/testUtils';
import bcrypt from 'bcryptjs';

const { bootstrapOwner } = require('../../prisma/bootstrap-owner');
const { rotateAccountCredentials } = require('../../prisma/rotate-account-credentials');
const input = {
  email: 'test-bootstrap-owner@example.com',
  password: 'LocalBootstrap123!',
  firstName: 'Test',
  lastName: 'Owner',
  organizationName: 'Bootstrap test',
  organizationSlug: 'bootstrap-test',
};

describe('Guarded one-time owner bootstrap', () => {
  beforeEach(cleanupTestData);
  afterAll(cleanupTestData);

  it('creates one business owner and refuses repeat credential resets', async () => {
    const result = await bootstrapOwner(prisma, input);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: result.id } });
    expect(before.role).toBe('OWNER');
    expect(before.organizationId).toBeTruthy();
    expect(await bcrypt.compare(input.password, before.passwordHash)).toBe(true);
    await expect(
      bootstrapOwner(prisma, { ...input, password: 'OtherBootstrap123!' })
    ).rejects.toThrow('already exists');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: result.id } })).passwordHash).toBe(
      before.passwordHash
    );
  });

  it('serializes concurrent bootstrap attempts and rolls back the loser', async () => {
    const result = await Promise.allSettled([
      bootstrapOwner(prisma, input),
      bootstrapOwner(prisma, {
        ...input,
        email: 'test-other-owner@example.com',
        organizationSlug: 'other-bootstrap',
      }),
    ]);
    expect(result.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.user.count({ where: { role: 'OWNER' } })).toBe(1);
    expect(await prisma.organization.count()).toBe(1);
  });

  it('refuses weak/missing provisioning inputs without creating a business', async () => {
    await expect(bootstrapOwner(prisma, { ...input, password: '' })).rejects.toThrow(
      'Supply owner identity'
    );
    expect(await prisma.organization.count()).toBe(0);
  });

  it('reactivates reviewed accounts through explicit credential rotation and revokes former sessions', async () => {
    const result = await bootstrapOwner(prisma, input);
    await prisma.user.update({
      where: { id: result.id },
      data: { role: 'ADMIN', disabledAt: new Date() },
    });
    await rotateAccountCredentials(prisma, { userId: result.id, password: 'NewLocalPassword123!' });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.id } });
    expect(user.disabledAt).toBeNull();
    expect(user.sessionVersion).toBe(1);
    expect(await bcrypt.compare(input.password, user.passwordHash)).toBe(false);
    expect(await bcrypt.compare('NewLocalPassword123!', user.passwordHash)).toBe(true);
    expect(user.role).toBe('ADMIN');
    expect(user.isPlatformAdmin).toBe(false);
    await prisma.user.update({ where: { id: result.id }, data: { organizationId: null } });
    await expect(
      rotateAccountCredentials(prisma, { userId: result.id, password: 'OtherLocalPassword123!' })
    ).rejects.toThrow('Review administrator membership');
    await prisma.user.update({
      where: { id: result.id },
      data: { email: `deleted_${result.id}@deleted.com` },
    });
    await expect(
      rotateAccountCredentials(prisma, { userId: result.id, password: 'OtherLocalPassword123!' })
    ).rejects.toThrow('missing or deleted');
  });
});
