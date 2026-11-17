// Labs demo: Moose answers questions about the currently loaded analytics
// on the client. No LLM, no API keys, no network calls.
import { adaptGa4Report } from './ga4Adapter';
import { formatNumber, percentChange } from './formatters';
import { ANALYTICS_PAGES, DATE_RANGE_OPTIONS, selectAnalyticsDashboard } from './mockAnalytics';

export const SUGGESTED_QUESTIONS = [
    'Which event is selling fastest?',
    'How did last weekend compare?',
    'Where are my buyers coming from?',
    'What should I promote next?',
];

const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const weekdayUtc = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();

const addDaysIso = (iso, days) => {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

const formatRangeDay = (iso) => {
    const date = new Date(`${iso}T12:00:00Z`);
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date);
    const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date);
    const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' }).format(date);
    return `${weekday} ${month} ${day}`;
};

export const rangeLabel = (dashboard) => {
    const option = DATE_RANGE_OPTIONS.find((item) => item.id === String(dashboard.range));
    return option?.label?.toLowerCase() || `the last ${dashboard.rangeDays} days`;
};

export const changePhrase = (current, prior) => {
    const pct = percentChange(current, prior);
    if (pct == null) return 'no prior-period comparison is available';
    const rounded = Math.round(Math.abs(pct));
    if (rounded === 0) return 'about even with the prior period';
    if (pct > 0) return `${rounded}% ahead of the prior period`;
    return `${rounded}% behind the prior period`;
};

export const eventSalesForRange = (range, select = selectAnalyticsDashboard) => (
    ANALYTICS_PAGES
        .filter((page) => page.id !== 'all' && !page.empty)
        .map((page) => {
            const dashboard = select({ pageId: page.id, range });
            if (dashboard.empty || !dashboard.kpis) return null;
            const purchases = dashboard.kpis.purchases.current;
            const visitors = dashboard.kpis.visitors.current;
            return {
                id: page.id,
                name: dashboard.pageName,
                purchases,
                prior: dashboard.kpis.purchases.prior,
                visitors,
                rate: visitors ? purchases / visitors : 0,
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.purchases - left.purchases || right.rate - left.rate)
);

const purchasesByDate = (dashboard) => {
    const rows = dashboard.reports?.daily ? adaptGa4Report(dashboard.reports.daily) : [];
    const totals = {};
    rows.forEach((row) => {
        const raw = String(row.dimensions?.date || '');
        const iso = raw.includes('-')
            ? raw
            : raw.length === 8
                ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
                : null;
        if (!iso) return;
        totals[iso] = (totals[iso] || 0) + (row.metrics?.ecommercePurchases || 0);
    });
    return totals;
};

const visitorsOn = (dashboard, iso) => {
    const point = dashboard.chart?.current?.find((item) => item.x === iso);
    return point?.y || 0;
};

export const lastWeekends = (dashboard) => {
    const dates = (dashboard.chart?.current || []).map((point) => point.x).filter(Boolean);
    const available = new Set(dates);
    const weekends = dates
        .filter((iso) => weekdayUtc(iso) === 0)
        .map((sunday) => {
            const saturday = addDaysIso(sunday, -1);
            if (!available.has(saturday)) return null;
            return { saturday, sunday };
        })
        .filter(Boolean);

    const latest = weekends[weekends.length - 1] || null;
    const previous = weekends.length > 1 ? weekends[weekends.length - 2] : null;
    return { latest, previous };
};

const weekendTotals = (dashboard, weekend) => {
    if (!weekend) return { visitors: 0, purchases: 0 };
    const purchases = purchasesByDate(dashboard);
    return {
        visitors: visitorsOn(dashboard, weekend.saturday) + visitorsOn(dashboard, weekend.sunday),
        purchases: (purchases[weekend.saturday] || 0) + (purchases[weekend.sunday] || 0),
    };
};

const answerFastest = (dashboard) => {
    const sales = eventSalesForRange(dashboard.range);
    const top = sales[0];
    if (!top) return fallbackAnswer(dashboard);
    const range = rangeLabel(dashboard);
    const second = sales[1];
    let text = `${top.name} is selling fastest over ${range}, with ${formatNumber(top.purchases)} purchases from ${formatNumber(top.visitors)} visitors (${changePhrase(top.purchases, top.prior)}).`;
    if (second) {
        text += ` Next is ${second.name}, with ${formatNumber(second.purchases)} purchases.`;
    }
    if (dashboard.pageId && dashboard.pageId !== 'all') {
        const current = sales.find((item) => item.id === dashboard.pageId);
        if (current && current.id !== top.id) {
            const rank = sales.findIndex((item) => item.id === current.id) + 1;
            text += ` You're looking at ${dashboard.pageName} right now, which has ${formatNumber(current.purchases)} purchases (rank ${rank} of ${sales.length} in this range).`;
        } else if (current) {
            text += ` That's the event you have selected right now.`;
        }
    }
    return text;
};

const answerWeekend = (dashboard) => {
    const { latest, previous } = lastWeekends(dashboard);
    const range = rangeLabel(dashboard);
    const page = dashboard.pageName;
    if (!latest) {
        return `I don't have a full Saturday-Sunday in ${range} for ${page} yet. Over this range you had ${formatNumber(dashboard.kpis.visitors.current)} visitors and ${formatNumber(dashboard.kpis.purchases.current)} purchases.`;
    }
    const current = weekendTotals(dashboard, latest);
    const label = `${formatRangeDay(latest.saturday)}-${formatRangeDay(latest.sunday)}`;
    let text = `Last weekend (${label}) brought ${formatNumber(current.visitors)} visitors and ${formatNumber(current.purchases)} purchases on ${page}.`;
    if (previous) {
        const prior = weekendTotals(dashboard, previous);
        text += ` That's ${changePhrase(current.visitors, prior.visitors).replace('the prior period', `the weekend before (${formatRangeDay(previous.saturday)}-${formatRangeDay(previous.sunday)})`)}, when you had ${formatNumber(prior.visitors)} visitors and ${formatNumber(prior.purchases)} purchases.`;
    } else {
        const days = Math.max(1, dashboard.chart?.current?.length || dashboard.rangeDays || 1);
        const typicalTwoDay = Math.round((dashboard.kpis.visitors.current / days) * 2);
        text += ` Compared with a typical two-day stretch in ${range} (about ${formatNumber(typicalTwoDay)} visitors), ${current.visitors >= typicalTwoDay ? 'the weekend ran ahead' : 'the weekend was a little quieter'}.`;
    }
    return text;
};

const answerSources = (dashboard) => {
    const channels = [...(dashboard.channels || [])].sort((left, right) => right.purchases - left.purchases || right.visitors - left.visitors);
    const cities = [...(dashboard.cities || [])].sort((left, right) => right.visitors - left.visitors);
    const topChannel = channels[0];
    const topCity = cities[0];
    const range = rangeLabel(dashboard);
    let text = `On ${dashboard.pageName} over ${range}, `;
    if (topChannel) {
        text += `${topChannel.label} is your strongest source, with ${formatNumber(topChannel.visitors)} visitors and ${formatNumber(topChannel.purchases)} purchases.`;
    } else {
        text += `I don't have channel data on this page yet.`;
    }
    if (channels[1]) {
        text += ` ${channels[1].label} is next (${formatNumber(channels[1].visitors)} visitors, ${formatNumber(channels[1].purchases)} purchases).`;
    }
    if (topCity) {
        text += ` The most visitors are coming from ${topCity.label} (${formatNumber(topCity.visitors)}).`;
    }
    if (dashboard.devices?.length) {
        const topDevice = [...dashboard.devices].sort((left, right) => right.visitors - left.visitors)[0];
        if (topDevice) {
            const label = topDevice.label || topDevice.id;
            text += ` Most people are on ${label}.`;
        }
    }
    return text;
};

const answerPromote = (dashboard) => {
    const range = rangeLabel(dashboard);
    const steps = dashboard.ticketPath || [];
    const leak = [...steps]
        .filter((step) => step.dropOffPercent != null && step.dropOff)
        .sort((left, right) => right.dropOffPercent - left.dropOffPercent)[0];
    const channels = [...(dashboard.channels || [])].sort((left, right) => right.purchases - left.purchases || right.visitors - left.visitors);
    const topChannel = channels[0];
    let text = `Looking at ${dashboard.pageName} over ${range}: you had ${formatNumber(dashboard.kpis.visitors.current)} visitors and ${formatNumber(dashboard.kpis.purchases.current)} purchases, ${changePhrase(dashboard.kpis.purchases.current, dashboard.kpis.purchases.prior)}.`;
    if (leak) {
        text += ` The biggest drop in the ticket path is ${leak.dropOff}. I'd start with a reminder or offer that helps people take the next step.`;
    }
    if (topChannel) {
        text += ` ${topChannel.label} is already your strongest source (${formatNumber(topChannel.visitors)} visitors, ${formatNumber(topChannel.purchases)} purchases), so a focused boost there usually goes further than spreading spend.`;
    }
    if (dashboard.pageId === 'all' || !dashboard.pageId) {
        const top = eventSalesForRange(dashboard.range)[0];
        if (top) {
            text += ` ${top.name} is also the fastest seller right now — worth keeping front and centre.`;
        }
    } else if (dashboard.headsUp?.[0]?.title) {
        text += ` One heads-up on this page: ${dashboard.headsUp[0].title}.`;
    }
    return text;
};

export const fallbackAnswer = (dashboard) => {
    if (!dashboard?.kpis) {
        return "I can only talk about the analytics on this page, and there isn't enough traffic here yet to go on.";
    }
    const live = dashboard.liveNow?.people
        ? ` ${formatNumber(dashboard.liveNow.people)} people are on your site right now.`
        : '';
    return `I'm Moose, Tixmo's assistant. I can only talk about the analytics on this page. You're looking at ${dashboard.pageName} for ${rangeLabel(dashboard)}: ${formatNumber(dashboard.kpis.visitors.current)} visitors, ${formatNumber(dashboard.kpis.pageViews.current)} page views and ${formatNumber(dashboard.kpis.purchases.current)} purchases, ${changePhrase(dashboard.kpis.purchases.current, dashboard.kpis.purchases.prior)}.${live} Try asking which event is selling fastest, how last weekend compared, where buyers are coming from, or what to promote next.`;
};

const RULES = [
    { id: 'fastest', test: (q) => /fastest|selling fastest|sell(?:s|ing) the most|which event|top event|best seller/.test(q), answer: answerFastest },
    { id: 'weekend', test: (q) => /weekend/.test(q), answer: answerWeekend },
    { id: 'sources', test: (q) => /buyers coming|where are my buyers|where.*from|traffic source|which channel|cities|coming from/.test(q), answer: answerSources },
    { id: 'promote', test: (q) => /promote|advertis|boost|what should i|spend|push next/.test(q), answer: answerPromote },
];

export const answerMooseQuestion = (question, dashboard) => {
    const query = normalize(question);
    if (!query) return fallbackAnswer(dashboard);
    const rule = RULES.find((item) => item.test(query));
    return (rule ? rule.answer : fallbackAnswer)(dashboard);
};
