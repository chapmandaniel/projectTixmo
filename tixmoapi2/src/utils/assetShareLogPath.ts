// Classify only the public bearer route; never return its suffix, query or fragment.
export function assetShareLogPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let pathname: string;
  try {
    pathname = new URL(value, 'https://redaction.invalid').pathname;
  } catch {
    return null;
  }
  // Decode individual ASCII route bytes so a malformed token escape cannot stop
  // classification of an encoded prefix. This is for redaction, never routing.
  pathname = pathname.replace(/%([a-f0-9]{2})/gi, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return /^\/api\/v1\/assets\/shares(?:\/|$)/i.test(pathname)
    ? '/api/v1/assets/shares/[redacted]'
    : null;
}
