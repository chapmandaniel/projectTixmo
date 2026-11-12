export const formatNumber = (value) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-CA').format(value);
};

export const formatCurrencyCad = (value) => {
    if (value === null || value === undefined) return '—';
    const amount = Number(value);
    const safe = Number.isFinite(amount) ? amount : 0;
    const digits = Math.abs(safe) >= 100 ? 0 : 2;
    const formatted = new Intl.NumberFormat('en-CA', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(Math.abs(safe));
    return `${safe < 0 ? '-' : ''}CA$${formatted}`;
};

export const percentChange = (current, prior) => {
    if (prior === null || prior === undefined || current === null || current === undefined) return null;
    if (prior === 0) return current === 0 ? 0 : null;
    return ((current - prior) / Math.abs(prior)) * 100;
};
