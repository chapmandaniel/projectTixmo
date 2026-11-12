export const formatNumber = (value) => {
    if (value === null || value === undefined) return '—';
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (absolute >= 1_000) return `${(value / 1_000).toFixed(absolute >= 10_000 ? 0 : 1)}K`;
    return new Intl.NumberFormat('en-CA').format(value);
};

export const formatPercent = (value, digits = 2) => {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(digits)}%`;
};

export const formatSignedPercent = (value, digits = 1) => {
    if (value === null || value === undefined) return '—';
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(digits)}%`;
};

export const formatCurrency = (value, currency = 'CAD') => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency,
        maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
};

export const formatDate = (isoDate, timeZone = 'America/St_Johns') => {
    if (!isoDate) return '—';
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        month: 'short',
        day: 'numeric',
    }).format(new Date(`${isoDate}T12:00:00`));
};

export const formatDateTime = (iso, timeZone = 'America/St_Johns') => {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(iso));
};

export const percentChange = (current, prior) => {
    if (prior === null || prior === undefined || current === null || current === undefined) return null;
    if (prior === 0) return current === 0 ? 0 : null;
    return ((current - prior) / Math.abs(prior)) * 100;
};
