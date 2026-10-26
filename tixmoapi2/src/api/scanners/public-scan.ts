// Gate devices only need an admit/deny decision, why, the ticket type, and a
// first name. The raw barcode and the buyer's email stay on the server.
export interface PublicScanResult {
  valid: boolean;
  reason: string | null;
  ticketTypeName: string | null;
  holderFirstName: string | null;
}

const nestedString = (source: unknown, key: string, field: string): string | null => {
  if (!source || typeof source !== 'object') return null;
  const child = (source as Record<string, unknown>)[key];
  if (!child || typeof child !== 'object') return null;
  const value = (child as Record<string, unknown>)[field];
  return typeof value === 'string' && value ? value : null;
};

export const presentScanResult = (result: {
  success?: boolean;
  reason?: string | null;
  ticket?: unknown;
}): PublicScanResult => ({
  valid: result?.success === true,
  reason: result?.reason ?? null,
  ticketTypeName: nestedString(result?.ticket, 'ticketType', 'name'),
  holderFirstName: nestedString(result?.ticket, 'user', 'firstName'),
});
