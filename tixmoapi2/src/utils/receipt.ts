import { config } from '../config/environment';

// Live checkout stores the amount charged. Ticket prices are tax-inclusive and
// feesAmount/taxAmount stay at their defaults, and no tax rate is stored.
// A dollar HST split would be invented, so receipts disclose inclusion only.
export const HST_INCLUDED_NOTE = 'Includes HST and all fees';

export interface ReceiptDisclosure {
  includesHstAndFees: true;
  hstNumber: string | null;
  hstAmount: null;
}

export const receiptDisclosure = (): ReceiptDisclosure => ({
  includesHstAndFees: true,
  hstNumber: config.hstNumber || null,
  hstAmount: null,
});

type MoneyInput = number | string | { toNumber: () => number };

export const formatMoney = (amount: MoneyInput, currency = 'CAD'): string => {
  const value =
    typeof amount === 'number'
      ? amount
      : typeof amount === 'string'
        ? Number(amount)
        : amount.toNumber();
  if (!Number.isFinite(value)) {
    throw new Error('Invalid money amount');
  }
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: String(currency || 'CAD')
      .trim()
      .toUpperCase(),
  }).format(value);
};

export const formatVenueAddress = (address: unknown): string => {
  if (typeof address === 'string') return address.trim();
  if (!address || typeof address !== 'object' || Array.isArray(address)) return '';
  const record = address as Record<string, unknown>;
  const part = (...keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  };
  return [
    part('line1', 'street', 'address1'),
    part('line2'),
    part('city'),
    part('province', 'state'),
    part('postalCode'),
    part('country'),
  ]
    .filter(Boolean)
    .join(', ');
};

export const summarizeTickets = (
  tickets: Array<{ ticketType?: { name?: string | null } | null }> | null | undefined
): string => {
  const counts = new Map<string, number>();
  for (const ticket of tickets || []) {
    const name = ticket.ticketType?.name?.trim() || 'Ticket';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  if (!counts.size) return '0';
  return [...counts.entries()].map(([name, count]) => `${count} × ${name}`).join(', ');
};

export const venueLine = (name?: string | null, address?: string | null): string => {
  const line = [name?.trim(), address?.trim()].filter(Boolean).join(', ');
  return line || 'Venue to be announced';
};
