import { createHash, randomBytes } from 'crypto';
import prisma from '../../config/prisma';
import { config } from '../../config/environment';
import { ApiError } from '../../utils/ApiError';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import { isDisabledAccount } from '../../utils/accountSession';
import { notificationService } from '../../utils/notificationService';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const eligible = (
  user: {
    role: string;
    disabledAt: Date | null;
    email: string;
    isPlatformAdmin: boolean;
    twoFactorEnabled: boolean;
  } | null
) =>
  user &&
  user.role === 'CUSTOMER' &&
  !isDisabledAccount(user) &&
  !user.isPlatformAdmin &&
  !user.twoFactorEnabled;
const invalid = () =>
  ApiError.unauthorized('Reset link is invalid or expired. Request another link.');
export function buyerResetLink(token: string): string {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid buyer recovery proof');
  const origin = new URL(config.clientUrl);
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== '/' ||
    !(
      origin.protocol === 'https:' ||
      (config.nodeEnv === 'test' &&
        origin.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))
    )
  ) {
    throw new Error('Invalid configured buyer recovery origin');
  }
  // CLIENT_URL is an origin, never a request Host or a caller-supplied redirect.
  origin.pathname = '/reset-password';
  origin.hash = `token=${token}`;
  return origin.href;
}
export async function requestBuyerPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const reference = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (!reference) return;
  const token = randomBytes(32).toString('hex'),
    tokenHash = hash(token);
  // Validate trusted origin before any token is persisted.
  const link = buyerResetLink(token);
  const reset = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${reference.id} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: reference.id } });
    if (!eligible(user) || !user || user.email !== normalized) return null;
    const previous = await tx.buyerPasswordReset.findUnique({ where: { userId: user.id } });
    // An accepted request during cooldown keeps the already issued link valid.
    if (previous && previous.createdAt.getTime() > Date.now() - 60000) return null;
    return tx.buyerPasswordReset.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        tokenHash,
        email: user.email,
        sessionVersion: user.sessionVersion,
        expiresAt: new Date(Date.now() + 15 * 60000),
      },
      update: {
        tokenHash,
        email: user.email,
        sessionVersion: user.sessionVersion,
        expiresAt: new Date(Date.now() + 15 * 60000),
        createdAt: new Date(),
      },
    });
  });
  if (!reset) return;
  const delivered = await notificationService.sendBuyerPasswordReset(reset.email, link);
  if (!delivered) {
    // A failed older send must never remove a newer issued link.
    await prisma.buyerPasswordReset.deleteMany({
      where: { userId: reset.userId, tokenHash, sessionVersion: reset.sessionVersion },
    });
  }
}
export async function redeemBuyerPasswordReset(token: string, password: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw invalid();
  if (!validatePasswordStrength(password).isValid || Buffer.byteLength(password, 'utf8') > 72)
    throw ApiError.badRequest('Password does not meet the required strength');
  const tokenHash = hash(token);
  const reference = await prisma.buyerPasswordReset.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });
  if (!reference) throw invalid();
  const passwordHash = await hashPassword(password);
  const email = await prisma.$transaction(async (tx) => {
    // Same lock order as issuance; lookup above is only a user-id hint.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${reference.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: reference.userId } });
    const reset = await tx.buyerPasswordReset.findUnique({ where: { userId: reference.userId } });
    if (
      !eligible(user) ||
      !user ||
      !reset ||
      reset.tokenHash !== tokenHash ||
      reset.expiresAt <= new Date() ||
      reset.email !== user.email ||
      reset.sessionVersion !== user.sessionVersion
    )
      throw invalid();
    const changed = await tx.user.updateMany({
      where: {
        id: user.id,
        email: reset.email,
        sessionVersion: reset.sessionVersion,
        role: 'CUSTOMER',
        disabledAt: null,
        isPlatformAdmin: false,
        twoFactorEnabled: false,
      },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    if (changed.count !== 1) throw invalid();
    const consumed = await tx.buyerPasswordReset.deleteMany({
      where: { userId: user.id, tokenHash },
    });
    if (consumed.count !== 1) throw invalid();
    // No role/org/emailVerified/MFA mutation and no automatic session issuance.
    return user.email;
  });
  await notificationService.sendBuyerPasswordChanged(email);
}
