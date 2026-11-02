// Offline admission is judged at the device clock when that clock is plausible.
// A missing, future, or ancient stamp is not a time the gate can trust.
export const OFFLINE_FUTURE_SKEW_MS = 2 * 60 * 1000;
export const OFFLINE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// null means the stamp cannot be parsed and the upload must be rejected.
// A parsed but implausible stamp falls back to server time.
export function offlineAdmissionTime(scannedAt: string, now = new Date()): Date | null {
  const claimedMs = new Date(scannedAt).getTime();
  if (!Number.isFinite(claimedMs)) return null;
  const nowMs = now.getTime();
  if (claimedMs > nowMs + OFFLINE_FUTURE_SKEW_MS) return new Date(nowMs);
  if (claimedMs < nowMs - OFFLINE_MAX_AGE_MS) return new Date(nowMs);
  return new Date(claimedMs);
}
