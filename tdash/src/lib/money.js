export const HST_INCLUDED_NOTE = 'Includes HST and all fees';
export const PRICE_INCLUDES_NOTE = 'Price includes HST and all fees.';

// CAD is always CA$ so totals and HST lines share one formatter. Do not prefix "$CAD".
export const formatEventMoney = (value, currency = 'CAD') => {
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    const code = String(currency || 'CAD')
        .trim()
        .toUpperCase();
    if (code === 'CAD') {
        const formatted = new Intl.NumberFormat('en-CA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Math.abs(safe));
        return `${safe < 0 ? '-' : ''}CA$${formatted}`;
    }
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: code,
    }).format(safe);
};

export const hstRegistrationLine = (hstNumber) => {
    const value = String(hstNumber || '').trim();
    return value ? `HST no. ${value}` : '';
};

export const formatHstPercent = (rate = 0.15) => {
    const value = Number(rate);
    if (!Number.isFinite(value)) return '15';
    const scaled = Math.round(value * 10000) / 100;
    return Number(scaled.toFixed(2)).toString();
};

const toCents = (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100 + Math.sign(value) * Number.EPSILON);
};

// Same inclusive split as the API: total * rate / (1 + rate), once per total.
export const includedHstAmount = (total, rate = 0.15) => {
    const normalizedRate = Number(rate);
    const safeRate = Number.isFinite(normalizedRate) ? normalizedRate : 0.15;
    const hstCents = Math.round((toCents(total) * safeRate) / (1 + safeRate));
    return hstCents / 100;
};

export const hstAmountLine = (total, rate = 0.15, amount = undefined) => {
    const normalizedRate = rate == null || rate === '' ? 0.15 : Number(rate);
    const included =
        amount == null || amount === '' ? includedHstAmount(total, normalizedRate) : Number(amount);
    const dollars = Number.isFinite(included) ? included : 0;
    return `Includes HST (${formatHstPercent(normalizedRate)}%): ${formatEventMoney(dollars, 'CAD')}`;
};
