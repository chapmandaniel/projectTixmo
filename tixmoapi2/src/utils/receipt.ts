import { config } from '../config/environment';

// Prices are tax-inclusive. New orders store includedHstAmount in taxAmount.
// Historical rows were left at 0 and are not backfilled; a receipt falls back
// to the same formula when the stored amount is still zero.
export const HST_INCLUDED_NOTE = 'Includes HST and all fees';

export interface ReceiptDisclosure {
  includesHstAndFees: true;
  hstNumber: string | null;
  hstRate: number;
  hstAmount: number | null;
}

type MoneyInput = number | string | { toNumber: () => number };

const asNumber = (amount: MoneyInput): number => {
  const value =
    typeof amount === 'number'
      ? amount
      : typeof amount === 'string'
        ? Number(amount)
        : amount.toNumber();
  if (!Number.isFinite(value)) throw new Error('Invalid money amount');
  return value;
};

const toCents = (amount: number): number => {
  const cents = Math.round(amount * 100 + Math.sign(amount) * Number.EPSILON);
  if (!Number.isSafeInteger(cents)) throw new Error('Invalid money amount');
  return cents;
};

// Inclusive tax, rounded to the cent once: total * rate / (1 + rate).
export const includedHstAmount = (total: MoneyInput, rate: number): number => {
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error('Invalid HST rate');
  const hstCents = Math.round((toCents(asNumber(total)) * rate) / (1 + rate));
  return hstCents / 100;
};

export const formatHstPercent = (rate: number): string => {
  const scaled = Math.round(rate * 10000) / 100;
  return Number(scaled.toFixed(2)).toString();
};

export const formatHstAmountLine = (amount: number, rate: number, currency = 'CAD'): string =>
  `Includes HST (${formatHstPercent(rate)}%): ${formatMoney(amount, currency)}`;

export const configuredHstRate = (): number =>
  typeof config.hstRate === 'number' ? config.hstRate : 0.15;

// Prefer the amount stored on the order. Zero means a historical row that was
// never filled, or a total whose included tax rounds to nothing.
export const receiptHstAmount = (
  total: MoneyInput,
  rate: number,
  stored?: MoneyInput | null
): number => {
  if (stored !== undefined && stored !== null && stored !== '') {
    const value = asNumber(stored);
    if (value > 0) return toCents(value) / 100;
  }
  return includedHstAmount(total, rate);
};

export const receiptDisclosure = (total?: MoneyInput | null): ReceiptDisclosure => {
  const rate = configuredHstRate();
  const hasTotal = total !== undefined && total !== null && total !== '';
  return {
    includesHstAndFees: true,
    hstNumber: config.hstNumber || null,
    hstRate: rate,
    hstAmount: hasTotal ? includedHstAmount(total, rate) : null,
  };
};

export const formatMoney = (amount: MoneyInput, currency = 'CAD'): string => {
  const value = asNumber(amount);
  const code = String(currency || 'CAD')
    .trim()
    .toUpperCase();
  if (code === 'CAD') {
    const formatted = new Intl.NumberFormat('en-CA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return `${value < 0 ? '-' : ''}CA$${formatted}`;
  }
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: code,
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
