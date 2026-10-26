export const HST_INCLUDED_NOTE = 'Includes HST and all fees';
export const PRICE_INCLUDES_NOTE = 'Price includes HST and all fees.';

// en-CA CAD renders as "$50.00". Do not prefix a currency code ("$CAD 50.00").
export const formatEventMoney = (value, currency = 'CAD') => {
    const amount = Number(value);
    const code = String(currency || 'CAD')
        .trim()
        .toUpperCase();
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: code,
    }).format(Number.isFinite(amount) ? amount : 0);
};

export const hstRegistrationLine = (hstNumber) => {
    const value = String(hstNumber || '').trim();
    return value ? `HST no. ${value}` : '';
};
