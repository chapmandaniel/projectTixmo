const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Lifetime of a passwordless staff invitation.
 * StaffInvitation.expiresAt and the invite email both use this value.
 */
export const STAFF_INVITATION_TTL_MS = 48 * MS_PER_HOUR;

/** Hours derived from {@link STAFF_INVITATION_TTL_MS}, for invite copy. */
export const staffInvitationTtlHours = (ttlMs: number = STAFF_INVITATION_TTL_MS): number =>
  ttlMs / MS_PER_HOUR;

export const staffInvitationExpiresAt = (now: number = Date.now()): Date =>
  new Date(now + STAFF_INVITATION_TTL_MS);
