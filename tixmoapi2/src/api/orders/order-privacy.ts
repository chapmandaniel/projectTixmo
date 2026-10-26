// OWNER (5) sits above ADMIN (4), then MANAGER (3). PROMOTER and below do not
// receive the buyer's email on staff order detail.
const BUYER_EMAIL_ROLES = new Set(['OWNER', 'ADMIN', 'MANAGER']);

export const buyerEmailVisible = (role?: string | null): boolean =>
  BUYER_EMAIL_ROLES.has(role || '');

// Last four characters only. Short values are fully hidden.
export const maskBarcode = (barcode: unknown): string => {
  const value = typeof barcode === 'string' ? barcode.trim() : '';
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
};

export const presentOrderDetail = <T extends object>(order: T, role?: string | null): T => {
  const record = order as T & { user?: { email?: string | null } | null };
  if (!record.user || buyerEmailVisible(role)) return order;
  const { email, ...user } = record.user;
  void email;
  return { ...record, user };
};
