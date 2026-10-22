// Classify malformed recovery URLs too; never return their suffix, query or fragment.
export function buyerRecoveryLogPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let pathname: string;
  try {
    pathname = new URL(value, 'https://redaction.invalid').pathname;
  } catch {
    return null;
  }
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    /* classify the undecoded prefix */
  }
  const action = pathname.match(/^\/api\/v1\/auth\/(forgot-password|reset-password)/i)?.[1];
  return action ? `/api/v1/auth/${action.toLowerCase()}` : null;
}
