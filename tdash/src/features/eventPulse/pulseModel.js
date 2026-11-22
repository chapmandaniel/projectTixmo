// Labs demo: Event Pulse. Works out how an event is doing from numbers the
// dashboard already loads (tickets sold, capacity, the on-sale window and daily
// sales). Everything here is plain arithmetic in the browser: no new API, no
// model call. The three-word verdict is what the promoter reads first.

const DAY = 86400000;
const HOUR = 3600000;

export const PULSE = {
    hot: { id: 'hot', label: 'Sizzling Hot' },
    good: { id: 'good', label: 'Looking Good' },
    attention: { id: 'attention', label: 'Needs Attention' },
};

// A healthy show finishes about this full. The "usual path" aims here.
export const HEALTHY_FINISH = 0.85;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const time = (value) => {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
};
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Share of its final sales a typical show has made once `t` (0..1) of the
 * on-sale window has passed: a quick start, a quiet middle and a late rush.
 */
export const usualShare = (t) => {
    const x = clamp(Number(t) || 0, 0, 1);
    return 0.3 * (x ** 0.6) + 0.7 * (x ** 3);
};

// Inverse of usualShare by bisection (usualShare only ever rises).
export const whenUsualShare = (share) => {
    const target = clamp(share, 0, 1);
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i += 1) {
        const mid = (lo + hi) / 2;
        if (usualShare(mid) < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
};

const sortedDays = (salesByDay) => (Array.isArray(salesByDay) ? salesByDay : [])
    .filter((day) => day && day.date)
    .map((day) => ({ date: String(day.date).slice(0, 10), tickets: Number(day.tickets) || 0, orders: Number(day.orders) || 0, revenue: Number(day.revenue) || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));

const ticketsBetween = (days, fromMs, toMs) => {
    const from = dayKey(fromMs);
    const to = dayKey(toMs);
    return days.filter((day) => day.date > from && day.date <= to).reduce((sum, day) => sum + day.tickets, 0);
};

/**
 * @param {{ event: object, ticketsSold?: number, ticketsUsed?: number, salesByDay?: Array, now?: number }} input
 */
export const buildPulse = ({ event, ticketsSold, ticketsUsed, salesByDay, now = Date.now() }) => {
    const days = sortedDays(salesByDay);
    const capacity = Number(event?.capacity) > 0 ? Number(event.capacity) : 0;
    const sold = Number.isFinite(Number(ticketsSold)) ? Number(ticketsSold) : days.reduce((sum, day) => sum + day.tickets, 0);
    const used = Number(ticketsUsed) || 0;
    const start = time(event?.startDatetime || event?.startDateTime);
    const end = time(event?.endDatetime || event?.endDateTime) || (start ? start + 4 * HOUR : null);
    const firstSale = days.length ? time(`${days[0].date}T12:00:00Z`) : null;
    const salesStart = time(event?.salesStart) || firstSale || time(event?.createdAt);
    const status = String(event?.status || '').toUpperCase();

    let phase = 'upcoming';
    if (status === 'CANCELLED') phase = 'cancelled';
    else if (status === 'COMPLETED' || (end && now > end)) phase = 'past';
    else if (start && now >= start) phase = 'live';
    else if ((salesStart && salesStart > now) || ((status === 'DRAFT' || status === 'PUBLISHED') && sold === 0)) phase = 'presale';

    const soldPct = capacity ? sold / capacity : null;
    const soldOut = status === 'SOLD_OUT' || (soldPct != null && soldPct >= 0.995);
    const daysToGo = start ? Math.max(0, Math.ceil((start - now) / DAY)) : null;
    const daysToOnSale = salesStart && salesStart > now ? Math.ceil((salesStart - now) / DAY) : null;
    const windowMs = start && salesStart && start > salesStart ? start - salesStart : null;
    const elapsed = windowMs ? clamp((now - salesStart) / windowMs, 0, 1) : null;
    const usualNow = elapsed == null ? null : usualShare(elapsed);
    const expectedPct = usualNow == null ? null : HEALTHY_FINISH * usualNow;
    const ratio = soldPct != null && expectedPct ? soldPct / expectedPct : null;

    const last7 = ticketsBetween(days, now - 7 * DAY, now);
    const prev7 = ticketsBetween(days, now - 14 * DAY, now - 7 * DAY);
    const momentum = prev7 > 0 ? (last7 - prev7) / prev7 : null;

    // Where it lands if the rest of the sale follows the usual shape from here.
    const canForecast = phase === 'upcoming' && soldPct != null && usualNow != null && elapsed >= 0.1 && !soldOut;
    const rawForecast = canForecast ? soldPct / usualNow : null;
    const forecastPct = rawForecast == null ? null : Math.min(1, rawForecast);
    let sellOutAt = null;
    if (rawForecast != null && rawForecast >= 1 && windowMs) {
        sellOutAt = salesStart + whenUsualShare(usualNow / soldPct) * windowMs;
        if (sellOutAt <= now) sellOutAt = now + DAY;
    }

    let verdict = null;
    if (phase === 'upcoming') {
        if (soldOut) verdict = 'hot';
        else if (ratio == null) verdict = 'good';
        else if (ratio >= 1.15 || (ratio >= 1 && momentum != null && momentum >= 0.2)) verdict = 'hot';
        else if (ratio < 0.8 || (ratio < 0.95 && momentum != null && momentum <= -0.3)) verdict = 'attention';
        else verdict = 'good';
    }

    let pace = null;
    if (soldOut) pace = 'soldOut';
    else if (ratio != null) pace = ratio >= 1.05 ? 'ahead' : ratio <= 0.95 ? 'behind' : 'on';

    return {
        phase,
        verdict,
        label: verdict ? PULSE[verdict].label : null,
        capacity,
        sold,
        used,
        left: capacity ? Math.max(0, capacity - sold) : null,
        soldPct,
        soldOut,
        turnout: sold > 0 ? used / sold : null,
        start,
        end,
        salesStart,
        daysToGo,
        daysToOnSale,
        elapsed,
        expectedPct,
        ratio,
        pace,
        last7,
        prev7,
        momentum,
        forecastPct,
        sellOutAt,
        days,
        now,
    };
};

/**
 * The picture behind the verdict: tickets sold so far, the usual path to a
 * healthy show, and where this one is heading. One point per step, at most
 * ~60 points so the chart stays readable for a six-month sale.
 */
export const buildSalesPath = (pulse) => {
    const { salesStart, start, capacity, days, now, sold, phase } = pulse;
    if (!salesStart || !start || start <= salesStart || !capacity) return null;
    const windowMs = start - salesStart;
    const totalDays = Math.max(1, Math.round(windowMs / DAY));
    const step = Math.max(1, Math.ceil(totalDays / 60));
    const todayT = clamp((now - salesStart) / windowMs, 0, 1);
    const usualNow = usualShare(todayT);
    const stops = new Set();
    for (let d = 0; d <= totalDays; d += step) stops.add(d);
    stops.add(totalDays);
    const todayDay = Math.round(todayT * totalDays);
    if (phase !== 'past') stops.add(todayDay);

    let running = 0;
    let cursor = 0;
    const cumulativeAt = (ms) => {
        const key = dayKey(ms);
        while (cursor < days.length && days[cursor].date <= key) {
            running += days[cursor].tickets;
            cursor += 1;
        }
        return running;
    };

    const points = [...stops].sort((a, b) => a - b).map((d) => {
        const ms = salesStart + d * DAY;
        const t = d / totalDays;
        const isPastOrToday = phase === 'past' || d <= todayDay;
        const counted = cumulativeAt(Math.min(ms, now));
        const actual = isPastOrToday ? (d === todayDay && phase !== 'past' ? sold : Math.min(counted, sold)) : null;
        const forecast = phase !== 'past' && pulse.forecastPct != null && d >= todayDay && usualNow > 0
            ? Math.min(capacity, sold * (usualShare(t) / usualNow))
            : null;
        return { day: d, ms, t, actual, usual: capacity * HEALTHY_FINISH * usualShare(t), forecast };
    });
    if (phase === 'past' && points.length) points[points.length - 1].actual = sold;

    const best = days.reduce((top, day) => (day.tickets > (top?.tickets || 0) ? day : top), null);
    const finish = phase === 'past' || pulse.forecastPct == null ? null : pulse.forecastPct >= 1 ? 'Sold out' : `${Math.round(pulse.forecastPct * 100)}% full`;
    return { points, capacity, totalDays, todayDay: phase === 'past' ? null : todayDay, best, finish };
};

/** Ticket types as the promoter thinks of them: name, how many gone, sold out or not. */
export const summarizeTicketTypes = (types) => (Array.isArray(types) ? types : [])
    .map((type) => {
        const total = Number(type.quantity ?? type.quantityTotal) || 0;
        const sold = Number(type.sold ?? type.quantitySold) || 0;
        const pct = total ? clamp(sold / total, 0, 1) : 0;
        return {
            id: type.id || type.name,
            name: type.name,
            price: Number(type.price) || 0,
            sold,
            total,
            pct,
            soldOut: String(type.status || '').toUpperCase() === 'SOLD_OUT' || (total > 0 && sold >= total),
        };
    })
    .filter((type) => type.name);
