export const formatNumber = (value) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-CA').format(Math.round(value));
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

export const formatDuration = (seconds) => {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}m ${rest}s`;
};

export const percentChange = (current, prior) => {
    if (prior === null || prior === undefined || current === null || current === undefined) return null;
    if (prior === 0) return current === 0 ? 0 : null;
    return ((current - prior) / Math.abs(prior)) * 100;
};

export const formatChartDay = (iso) => {
    if (!iso) return '';
    const value = String(iso);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00Z`)
        : new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date);
    const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date);
    const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' }).format(date);
    return `${weekday} ${month} ${day}`;
};

export const formatChartHover = ({ date, visitors, previous, forecast }) => {
    const day = formatChartDay(date);
    if (visitors != null && previous != null) {
        return `${day}: ${formatNumber(visitors)} visitors (last period ${formatNumber(previous)})`;
    }
    if (forecast != null) {
        return `${day}: on pace for about ${formatNumber(forecast)} visitors`;
    }
    if (visitors != null) {
        return `${day}: ${formatNumber(visitors)} visitors`;
    }
    return day;
};
