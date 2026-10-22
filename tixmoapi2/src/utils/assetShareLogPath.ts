// Classify only the public bearer route; never return its suffix, query or fragment.
export function assetShareLogPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const matches = (pathname: string) => {
    // Decode each route byte once, even when the bearer suffix has bad escapes.
    // This classifies logs only and never changes routing or the request URL.
    const decoded = pathname.replace(/%([a-f0-9]{2})/gi, (_match, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    return /^\/api\/v1\/assets\/shares(?:\/|$)/i.test(decoded);
  };
  // Inspect the original path before WHATWG URL parsing removes dot segments.
  const rawPath = value.match(/^(?:(?:https?:)?\/\/[^/?#]*)?(\/[^?#]*)/i)?.[1];
  if (rawPath && matches(rawPath)) return '/api/v1/assets/shares/[redacted]';
  try {
    if (matches(new URL(value, 'https://redaction.invalid').pathname))
      return '/api/v1/assets/shares/[redacted]';
  } catch {
    // A malformed non-share URL is left to the existing diagnostic behavior.
  }
  return null;
}
