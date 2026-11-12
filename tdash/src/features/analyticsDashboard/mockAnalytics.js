/**
 * Prototype-only analytics mocks.
 *
 * Traffic rows follow the GA4 Data API RunReport shape so a later wiring pass
 * can swap the source without changing the page. Sales rows follow Tixmo
 * GET /reports/sales. Pre-written copy is plain strings keyed by event + period.
 *
 * @typedef {Object} Ga4DimensionHeader
 * @property {string} name
 *
 * @typedef {Object} Ga4MetricHeader
 * @property {string} name
 *
 * @typedef {Object} Ga4DimensionValue
 * @property {string} value
 *
 * @typedef {Object} Ga4MetricValue
 * @property {string} value
 *
 * @typedef {Object} Ga4Row
 * @property {Ga4DimensionValue[]} dimensionValues
 * @property {Ga4MetricValue[]} metricValues
 *
 * @typedef {Object} Ga4RunReportResponse
 * @property {Ga4DimensionHeader[]} dimensionHeaders
 * @property {Ga4MetricHeader[]} metricHeaders
 * @property {Ga4Row[]} rows
 *
 * @typedef {Object} SalesReportRow
 * @property {string} date
 * @property {number} revenue
 * @property {number} ticketsSold
 * @property {number} ordersCount
 * @property {string} currency
 * @property {string} aggregationTimezone
 * @property {string} [eventId]
 *
 * @typedef {Object} AnalyticsEvent
 * @property {string} id
 * @property {string} name
 * @property {boolean} festival
 * @property {boolean} empty
 * @property {string} showDate
 * @property {number} capacity
 * @property {number} liveNow
 * @property {string} city
 */

export const MOCK_AS_OF = '2026-11-12';
export const MOCK_PROMOTER = 'Northlight Live (demo)';
export const DEFAULT_EVENT_ID = 'evt-aurora';
export const DEFAULT_RANGE = '28';

export const DATE_RANGE_OPTIONS = [
    { id: '7', short: '7 days', label: 'Last 7 days', days: 7 },
    { id: '28', short: '28 days', label: 'Last 28 days', days: 28 },
    { id: '90', short: '90 days', label: 'Last 90 days', days: 90 },
];

/** @type {AnalyticsEvent[]} */
export const ANALYTICS_EVENTS = [
    {
        id: 'evt-aurora',
        name: 'Aurora After Dark',
        festival: false,
        empty: false,
        showDate: '2026-12-05',
        capacity: 800,
        liveNow: 23,
        city: 'St. John\'s',
    },
    {
        id: 'evt-harbour',
        name: 'Harbour Lights Festival',
        festival: true,
        empty: false,
        showDate: '2026-12-20',
        capacity: 2500,
        liveNow: 61,
        city: 'St. John\'s',
    },
    {
        id: 'evt-fog',
        name: 'Fog City Strobe',
        festival: false,
        empty: false,
        showDate: '2026-11-28',
        capacity: 600,
        liveNow: 8,
        city: 'Mount Pearl',
    },
    {
        id: 'evt-quiet',
        name: 'Quiet Harbour Acoustic',
        festival: false,
        empty: true,
        showDate: '2027-01-16',
        capacity: 180,
        liveNow: 0,
        city: 'Harbour Grace',
    },
];

export const CHANNELS = [
    { id: 'instagram', label: 'Instagram', ga4: 'Organic Social' },
    { id: 'facebook', label: 'Facebook', ga4: 'Paid Social' },
    { id: 'google', label: 'Google', ga4: 'Organic Search' },
    { id: 'email', label: 'Email', ga4: 'Email' },
    { id: 'direct', label: 'Direct', ga4: 'Direct' },
    { id: 'other', label: 'Other', ga4: 'Referral' },
];

export const GA4_DIMENSIONS = ['date', 'sessionDefaultChannelGroup'];
export const GA4_METRICS = [
    'activeUsers',
    'screenPageViews',
    'itemViewEvents',
    'addToCarts',
    'checkouts',
    'ecommercePurchases',
];

export const EMPTY_STATE_MESSAGE = 'Not enough sales yet to show trends.';

const pad = (value) => String(value).padStart(2, '0');

const toIso = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const parseIso = (iso) => {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

const addDays = (iso, amount) => {
    const date = parseIso(iso);
    date.setUTCDate(date.getUTCDate() + amount);
    return toIso(date);
};

const toGa4Date = (iso) => iso.replaceAll('-', '');

const isoFromGa4 = (value) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;

const dateWindow = (endIso, days) => {
    const dates = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
        dates.push(addDays(endIso, -offset));
    }
    return dates;
};

const roundPreserveSum = (values, total) => {
    const floored = values.map((value) => Math.floor(value));
    let remainder = total - floored.reduce((sum, value) => sum + value, 0);
    const ranked = values
        .map((value, index) => ({ index, frac: value - Math.floor(value) }))
        .sort((left, right) => right.frac - left.frac);
    const next = [...floored];
    for (let step = 0; remainder > 0 && ranked.length; step += 1) {
        next[ranked[step % ranked.length].index] += 1;
        remainder -= 1;
    }
    return next;
};

const spreadAcrossDays = (total, dates, spikeDate, spikeFactor = 1) => {
    if (!dates.length) return [];
    const weights = dates.map((iso) => {
        const weekday = parseIso(iso).getUTCDay();
        const weekend = weekday === 5 || weekday === 6 ? 1.35 : 1;
        const spike = iso === spikeDate ? spikeFactor : 1;
        return Math.max(0.35, weekend * spike);
    });
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    return roundPreserveSum(weights.map((weight) => (weight / weightSum) * total), total);
};

const splitChannels = (total, mix) => {
    const values = CHANNELS.map((channel) => total * mix[channel.id]);
    return roundPreserveSum(values, total);
};

/**
 * Exact period totals so event/range switches change the on-screen numbers.
 * Nested bands (7 inside 28 inside 90) are used to build one daily series.
 */
const EVENT_PERIODS = {
    'evt-aurora': {
        mix: { instagram: 0.38, facebook: 0.16, google: 0.12, email: 0.18, direct: 0.1, other: 0.06 },
        avgTicket: 45,
        spikeDate: '2026-11-10',
        spikeFactor: 2.4,
        current: {
            7: { tickets: 98, visitors: 640, pageViews: 920, itemViews: 780, carts: 210, checkouts: 140, purchases: 76 },
            28: { tickets: 412, visitors: 980, pageViews: 1480, itemViews: 1210, carts: 340, checkouts: 198, purchases: 118 },
            90: { tickets: 640, visitors: 1680, pageViews: 2540, itemViews: 1980, carts: 520, checkouts: 310, purchases: 188 },
        },
        prior: {
            7: { tickets: 126, visitors: 710, pageViews: 1010, itemViews: 840, carts: 248, checkouts: 168, purchases: 96 },
            28: { tickets: 301, visitors: 860, pageViews: 1290, itemViews: 1040, carts: 280, checkouts: 170, purchases: 92 },
            90: { tickets: 448, visitors: 1420, pageViews: 2100, itemViews: 1680, carts: 410, checkouts: 250, purchases: 140 },
        },
    },
    'evt-harbour': {
        mix: { instagram: 0.32, facebook: 0.22, google: 0.16, email: 0.14, direct: 0.1, other: 0.06 },
        avgTicket: 69,
        spikeDate: '2026-11-08',
        spikeFactor: 1.9,
        current: {
            7: { tickets: 286, visitors: 1920, pageViews: 2680, itemViews: 2140, carts: 610, checkouts: 390, purchases: 164 },
            28: { tickets: 1246, visitors: 6840, pageViews: 9120, itemViews: 7480, carts: 1980, checkouts: 1280, purchases: 540 },
            90: { tickets: 1688, visitors: 9420, pageViews: 12640, itemViews: 10210, carts: 2680, checkouts: 1720, purchases: 730 },
        },
        prior: {
            7: { tickets: 214, visitors: 1610, pageViews: 2210, itemViews: 1780, carts: 490, checkouts: 310, purchases: 122 },
            28: { tickets: 860, visitors: 5120, pageViews: 6840, itemViews: 5610, carts: 1480, checkouts: 940, purchases: 380 },
            90: { tickets: 1104, visitors: 7210, pageViews: 9640, itemViews: 7820, carts: 2010, checkouts: 1280, purchases: 490 },
        },
    },
    'evt-fog': {
        mix: { instagram: 0.18, facebook: 0.12, google: 0.1, email: 0.08, direct: 0.42, other: 0.1 },
        avgTicket: 40,
        spikeDate: '2026-11-07',
        spikeFactor: 1.6,
        current: {
            7: { tickets: 41, visitors: 520, pageViews: 740, itemViews: 610, carts: 120, checkouts: 72, purchases: 28 },
            28: { tickets: 187, visitors: 2100, pageViews: 2860, itemViews: 2340, carts: 410, checkouts: 248, purchases: 96 },
            90: { tickets: 274, visitors: 3180, pageViews: 4320, itemViews: 3510, carts: 620, checkouts: 360, purchases: 142 },
        },
        prior: {
            7: { tickets: 58, visitors: 610, pageViews: 860, itemViews: 700, carts: 150, checkouts: 94, purchases: 40 },
            28: { tickets: 220, visitors: 1980, pageViews: 2640, itemViews: 2160, carts: 460, checkouts: 280, purchases: 118 },
            90: { tickets: 310, visitors: 2860, pageViews: 3840, itemViews: 3120, carts: 690, checkouts: 410, purchases: 164 },
        },
    },
};

const METRIC_KEYS = ['visitors', 'pageViews', 'itemViews', 'carts', 'checkouts', 'purchases', 'tickets'];

const bandedDaily = (current, prior, spikeDate, spikeFactor) => {
    const current90 = dateWindow(MOCK_AS_OF, 90);
    const prior90 = dateWindow(addDays(current90[0], -1), 90);
    const build = (windowDates, totals) => {
        const last7 = windowDates.slice(-7);
        const mid21 = windowDates.slice(-28, -7);
        const early = windowDates.slice(0, windowDates.length - 28);
        /** @type {Record<string, Record<string, number>>} */
        const byDate = {};
        windowDates.forEach((iso) => {
            byDate[iso] = Object.fromEntries(METRIC_KEYS.map((key) => [key, 0]));
        });
        METRIC_KEYS.forEach((key) => {
            const late = spreadAcrossDays(totals[7][key], last7, spikeDate, spikeFactor);
            const mid = spreadAcrossDays(totals[28][key] - totals[7][key], mid21, spikeDate, spikeFactor);
            const old = spreadAcrossDays(totals[90][key] - totals[28][key], early, spikeDate, 1);
            last7.forEach((iso, index) => { byDate[iso][key] = late[index] || 0; });
            mid21.forEach((iso, index) => { byDate[iso][key] = mid[index] || 0; });
            early.forEach((iso, index) => { byDate[iso][key] = old[index] || 0; });
        });
        return byDate;
    };
    return {
        current: build(current90, current),
        prior: build(prior90, prior),
        current90,
        prior90,
    };
};

const buildGa4Report = (byDate, mix) => {
    /** @type {Ga4Row[]} */
    const rows = [];
    Object.entries(byDate).forEach(([iso, metrics]) => {
        const visitors = splitChannels(metrics.visitors, mix);
        const pageViews = splitChannels(metrics.pageViews, mix);
        const itemViews = splitChannels(metrics.itemViews, mix);
        const carts = splitChannels(metrics.carts, mix);
        const checkouts = splitChannels(metrics.checkouts, mix);
        const purchases = splitChannels(metrics.purchases, mix);
        CHANNELS.forEach((channel, index) => {
            rows.push({
                dimensionValues: [
                    { value: toGa4Date(iso) },
                    { value: channel.ga4 },
                ],
                metricValues: [
                    { value: String(visitors[index]) },
                    { value: String(pageViews[index]) },
                    { value: String(itemViews[index]) },
                    { value: String(carts[index]) },
                    { value: String(checkouts[index]) },
                    { value: String(purchases[index]) },
                ],
            });
        });
    });
    return {
        dimensionHeaders: GA4_DIMENSIONS.map((name) => ({ name })),
        metricHeaders: GA4_METRICS.map((name) => ({ name })),
        rows,
    };
};

const buildSalesRows = (eventId, byDate, avgTicket) => (
    Object.entries(byDate).map(([iso, metrics]) => ({
        date: iso,
        eventId,
        revenue: metrics.tickets * avgTicket,
        ticketsSold: metrics.tickets,
        ordersCount: metrics.purchases,
        currency: 'cad',
        aggregationTimezone: 'America/St_Johns',
    }))
);

/** @type {Record<string, { ga4: Ga4RunReportResponse, sales: SalesReportRow[] }>} */
const EVENT_SOURCE = Object.fromEntries(
    Object.entries(EVENT_PERIODS).map(([eventId, config]) => {
        const series = bandedDaily(config.current, config.prior, config.spikeDate, config.spikeFactor);
        const byDate = { ...series.prior, ...series.current };
        return [eventId, {
            ga4: buildGa4Report(byDate, config.mix),
            sales: buildSalesRows(eventId, byDate, config.avgTicket),
        }];
    })
);

EVENT_SOURCE['evt-quiet'] = {
    ga4: {
        dimensionHeaders: GA4_DIMENSIONS.map((name) => ({ name })),
        metricHeaders: GA4_METRICS.map((name) => ({ name })),
        rows: [],
    },
    sales: [],
};

const AI_COPY = {
    'evt-aurora': {
        7: {
            whatHappened: [
                'This week is quieter than last week after Tuesday’s Instagram rush.',
                'Most of the tickets this week still came from that lineup post, not from new ads.',
                'Checkout is the sticky step: people pick tickets, then leave before they pay.',
            ],
            headsUp: [
                {
                    id: 'stall',
                    title: 'Sales have stalled for 3 days',
                    reason: 'No paid tickets since Monday after a busy weekend.',
                    to: 'ticket-path',
                },
            ],
            pace: 'On pace to sell about 720 of 800 by show day.',
            channelTip: 'Instagram brought this week’s buyers. One more lineup clip could keep it going.',
            ticketPath: [
                'About 4 in 10 people who view the page never pick a ticket.',
                'A third of the people who pick tickets never start checkout.',
                '4 in 10 people who start checkout don\'t finish.',
                'Everyone who finished checkout has a ticket.',
            ],
        },
        28: {
            whatHappened: [
                'Sales jumped Tuesday: most buyers came from Instagram after your lineup post.',
                'Saturday browsing was busy, then ticket sales followed Sunday morning.',
                'Email still brings fewer visitors than Instagram, but those buyers spend more.',
            ],
            headsUp: [
                {
                    id: 'stall',
                    title: 'Sales have stalled for 3 days',
                    reason: 'Ticket sales were busy last weekend, then quiet since Monday.',
                    to: 'ticket-path',
                },
                {
                    id: 'checkout',
                    title: 'More people are leaving at checkout today',
                    reason: '4 in 10 people who start checkout don\'t finish.',
                    to: 'ticket-path',
                },
            ],
            pace: 'On pace to sell about 750 of 800 by show day.',
            channelTip: 'Email buyers spend the most. One more email this week could help.',
            ticketPath: [
                'About 3 in 10 people who view the page never pick a ticket.',
                '4 in 10 people who pick tickets never start checkout.',
                '4 in 10 people who start checkout don\'t finish.',
                'Bought tickets are running ahead of this time last month.',
            ],
        },
        90: {
            whatHappened: [
                'The last three months are still led by Instagram, with a clear jump after the lineup post.',
                'Email has been the quiet workhorse: fewer visitors, more tickets each time you send.',
                'Page visits grew faster than tickets in October, then sales caught up in November.',
            ],
            headsUp: [
                {
                    id: 'checkout',
                    title: 'More people are leaving at checkout today',
                    reason: 'Checkout drop-off is higher than earlier this fall.',
                    to: 'ticket-path',
                },
            ],
            pace: 'On pace to sell about 780 of 800 by show day.',
            channelTip: 'Google search is small but steady. Keep the event page clear so those visitors can buy.',
            ticketPath: [
                'About 3 in 10 people who view the page never pick a ticket.',
                'A third of the people who pick tickets never start checkout.',
                '4 in 10 people who start checkout don\'t finish.',
                'Bought tickets picked up after the November lineup post.',
            ],
        },
    },
    'evt-harbour': {
        7: {
            whatHappened: [
                'Weekend-pass sales led this week after you posted the Saturday lineup.',
                'Facebook brought in more buyers than last week, mostly Friday night.',
                'People are looking at Sunday, then buying Saturday instead.',
            ],
            headsUp: [
                {
                    id: 'saturday',
                    title: 'Saturday passes are selling faster than Sunday',
                    reason: 'Saturday is close to halfway sold; Sunday is still open.',
                    to: 'where-buyers-came-from',
                },
            ],
            pace: 'On pace to sell about 1,720 of 2,500 by show day.',
            channelTip: 'Facebook is catching up this week. A Friday reminder could fill more Saturday passes.',
            ticketPath: [
                'About 3 in 10 people who view the page never pick a ticket.',
                'A third of the people who pick tickets never start checkout.',
                '3 in 10 people who start checkout don\'t finish.',
                'Weekend-pass buyers are finishing checkout more often than single-day buyers.',
            ],
        },
        28: {
            whatHappened: [
                'Weekend pass sales led the week after you posted the Saturday lineup.',
                'Instagram still brings the most tickets, with Facebook close behind for the festival.',
                'Sales moved on lineup day: people opened the page from Instagram, then bought that night.',
            ],
            headsUp: [
                {
                    id: 'saturday',
                    title: 'Saturday passes are selling faster than Sunday',
                    reason: 'Saturday is filling first after the lineup post.',
                    to: 'where-buyers-came-from',
                },
                {
                    id: 'email',
                    title: 'Email has gone quiet for a week',
                    reason: 'No festival email has gone out since the early-bird note.',
                    to: 'where-buyers-came-from',
                },
            ],
            pace: 'On pace to sell about 1,800 of 2,500 by show day.',
            channelTip: 'Email buyers spend the most. One more email this week could help.',
            ticketPath: [
                'About 2 in 10 people who view the page never pick a ticket.',
                'A third of the people who pick tickets never start checkout.',
                '3 in 10 people who start checkout don\'t finish.',
                'Festival buyers who start checkout usually finish the same night.',
            ],
        },
        90: {
            whatHappened: [
                'Festival sales built slowly in September, then jumped when the full lineup went up.',
                'Instagram has been the main door in for three months.',
                'Early-bird email buyers still spend more per order than social buyers.',
            ],
            headsUp: [
                {
                    id: 'sunday',
                    title: 'Sunday is behind Saturday',
                    reason: 'Sunday passes need a push if you want both days even.',
                    to: 'where-buyers-came-from',
                },
            ],
            pace: 'On pace to sell about 1,860 of 2,500 by show day.',
            channelTip: 'Early-bird email still pays off. A “last chance to save” note could lift Sunday.',
            ticketPath: [
                'About 2 in 10 people who view the page never pick a ticket.',
                'A third of the people who pick tickets never start checkout.',
                '3 in 10 people who start checkout don\'t finish.',
                'Bought tickets rose after each lineup update.',
            ],
        },
    },
    'evt-fog': {
        7: {
            whatHappened: [
                'This week’s tickets mostly came from people who already knew the night.',
                'Sales are down from last week; the door list is still doing the work.',
                'Checkout drop-off ticked up on Thursday.',
            ],
            headsUp: [
                {
                    id: 'checkout',
                    title: 'More people are leaving at checkout today',
                    reason: 'People pick tickets, then leave before they pay.',
                    to: 'ticket-path',
                },
            ],
            pace: 'On pace to sell about 420 of 600 by show day.',
            channelTip: 'Most buyers typed your page directly. A reminder post could still reach friends of friends.',
            ticketPath: [
                'About 5 in 10 people who view the page never pick a ticket.',
                '4 in 10 people who pick tickets never start checkout.',
                '4 in 10 people who start checkout don\'t finish.',
                'Bought tickets this week are behind last week.',
            ],
        },
        28: {
            whatHappened: [
                'Most tickets this period came from people who already knew the night.',
                'Direct visits outsold Instagram and Facebook combined.',
                'Sales cooled after the first announcement week, then held steady.',
            ],
            headsUp: [
                {
                    id: 'checkout',
                    title: 'More people are leaving at checkout today',
                    reason: '4 in 10 people who start checkout don\'t finish.',
                    to: 'ticket-path',
                },
            ],
            pace: 'On pace to sell about 410 of 600 by show day.',
            channelTip: 'Most tickets came from people who typed your page directly. A reminder post could still help.',
            ticketPath: [
                'About 5 in 10 people who view the page never pick a ticket.',
                '4 in 10 people who pick tickets never start checkout.',
                '4 in 10 people who start checkout don\'t finish.',
                'Bought tickets are a little behind the last stretch.',
            ],
        },
        90: {
            whatHappened: [
                'Fog City has been a word-of-mouth night: direct visits lead every month.',
                'The first announcement week was the high point, then sales settled.',
                'Social posts bring looks, but they rarely finish as tickets.',
            ],
            headsUp: [],
            pace: 'On pace to sell about 430 of 600 by show day.',
            channelTip: 'Friends-of-friends are missing. One shareable clip could open a new door.',
            ticketPath: [
                'About 5 in 10 people who view the page never pick a ticket.',
                '4 in 10 people who pick tickets never start checkout.',
                '4 in 10 people who start checkout don\'t finish.',
                'Bought tickets never matched the first announcement week.',
            ],
        },
    },
    all: {
        7: {
            whatHappened: [
                'Across your nights, this week is softer than last week.',
                'Harbour Lights still accounts for most of the tickets.',
                'Checkout is the common sticky step on every event.',
            ],
            headsUp: [
                {
                    id: 'stall',
                    title: 'Sales have stalled for 3 days',
                    reason: 'Aurora After Dark has had no paid tickets since Monday.',
                    to: 'ticket-path',
                },
            ],
            pace: 'On pace to sell about 2,850 of 3,900 by show day, across these events.',
            channelTip: 'Instagram still leads. One post that names both Aurora and Harbour Lights could lift both.',
            ticketPath: [
                'About 3 in 10 people who view a page never pick a ticket.',
                'A third of the people who pick tickets never start checkout.',
                '4 in 10 people who start checkout don\'t finish.',
                'Harbour Lights is carrying most of this week\'s bought tickets.',
            ],
        },
        28: {
            whatHappened: [
                'Harbour Lights Festival is carrying most of the tickets this month.',
                'Sales jumped Tuesday on Aurora After Dark after the Instagram lineup post.',
                'Email buyers spend the most across every event.',
            ],
            headsUp: [
                {
                    id: 'stall',
                    title: 'Sales have stalled for 3 days',
                    reason: 'Aurora After Dark went quiet after last weekend.',
                    to: 'ticket-path',
                },
                {
                    id: 'checkout',
                    title: 'More people are leaving at checkout today',
                    reason: 'Checkout drop-off is up on Aurora and Fog City.',
                    to: 'ticket-path',
                },
                {
                    id: 'email',
                    title: 'Email has gone quiet for a week',
                    reason: 'No festival email has gone out since the early-bird note.',
                    to: 'where-buyers-came-from',
                },
            ],
            pace: 'On pace to sell about 2,960 of 3,900 by show day, across these events.',
            channelTip: 'Email buyers spend the most. One more email this week could help.',
            ticketPath: [
                'About 3 in 10 people who view a page never pick a ticket.',
                'A third of the people who pick tickets never start checkout.',
                '4 in 10 people who start checkout don\'t finish.',
                'Bought tickets are up from the previous 28 days, led by the festival.',
            ],
        },
        90: {
            whatHappened: [
                'The festival is the long story: sales built for months, then jumped with the lineup.',
                'Aurora After Dark had a shorter, sharper Instagram burst in November.',
                'Fog City stayed a direct-visit night the whole time.',
            ],
            headsUp: [
                {
                    id: 'sunday',
                    title: 'Sunday is behind Saturday',
                    reason: 'Harbour Lights Sunday passes still need a push.',
                    to: 'where-buyers-came-from',
                },
            ],
            pace: 'On pace to sell about 3,070 of 3,900 by show day, across these events.',
            channelTip: 'Three different doors in: Instagram for Aurora, Facebook for the festival, direct for Fog City.',
            ticketPath: [
                'About 3 in 10 people who view a page never pick a ticket.',
                'A third of the people who pick tickets never start checkout.',
                '3 in 10 people who start checkout don\'t finish.',
                'Bought tickets rose after each public lineup update.',
            ],
        },
    },
};

const metricIndex = (name) => GA4_METRICS.indexOf(name);

const rowMetric = (row, name) => Number(row.metricValues[metricIndex(name)]?.value || 0);

const rowDate = (row) => isoFromGa4(row.dimensionValues[0]?.value || '');

const rowChannel = (row) => row.dimensionValues[1]?.value || '';

const inWindow = (iso, dates) => dates[0] <= iso && iso <= dates[dates.length - 1];

const channelByGa4 = Object.fromEntries(CHANNELS.map((channel) => [channel.ga4, channel]));

const sumGa4 = (report, dates) => {
    const totals = {
        activeUsers: 0,
        screenPageViews: 0,
        itemViewEvents: 0,
        addToCarts: 0,
        checkouts: 0,
        ecommercePurchases: 0,
        byDay: {},
        byChannel: Object.fromEntries(CHANNELS.map((channel) => [channel.id, {
            visitors: 0,
            tickets: 0,
            purchases: 0,
        }])),
    };
    dates.forEach((iso) => {
        totals.byDay[iso] = { visitors: 0, tickets: 0, pageViews: 0 };
    });
    report.rows.forEach((row) => {
        const iso = rowDate(row);
        if (!inWindow(iso, dates)) return;
        const channel = channelByGa4[rowChannel(row)];
        const visitors = rowMetric(row, 'activeUsers');
        const pageViews = rowMetric(row, 'screenPageViews');
        const purchases = rowMetric(row, 'ecommercePurchases');
        totals.activeUsers += visitors;
        totals.screenPageViews += pageViews;
        totals.itemViewEvents += rowMetric(row, 'itemViewEvents');
        totals.addToCarts += rowMetric(row, 'addToCarts');
        totals.checkouts += rowMetric(row, 'checkouts');
        totals.ecommercePurchases += purchases;
        if (totals.byDay[iso]) {
            totals.byDay[iso].visitors += visitors;
            totals.byDay[iso].pageViews += pageViews;
        }
        if (channel) {
            totals.byChannel[channel.id].visitors += visitors;
            totals.byChannel[channel.id].purchases += purchases;
        }
    });
    return totals;
};

const sumSales = (rows, dates) => {
    const totals = { tickets: 0, revenue: 0, orders: 0, byDay: {} };
    dates.forEach((iso) => {
        totals.byDay[iso] = { tickets: 0, revenue: 0 };
    });
    rows.forEach((row) => {
        if (!inWindow(row.date, dates)) return;
        totals.tickets += row.ticketsSold;
        totals.revenue += row.revenue;
        totals.orders += row.ordersCount;
        if (totals.byDay[row.date]) {
            totals.byDay[row.date].tickets += row.ticketsSold;
            totals.byDay[row.date].revenue += row.revenue;
        }
    });
    return totals;
};

const mergeGa4 = (reports) => ({
    dimensionHeaders: GA4_DIMENSIONS.map((name) => ({ name })),
    metricHeaders: GA4_METRICS.map((name) => ({ name })),
    rows: reports.flatMap((report) => report.rows),
});

const copyFor = (eventId, range) => {
    const bucket = AI_COPY[eventId] || AI_COPY.all;
    return bucket[range] || bucket[28];
};

const boughtPer100 = (purchases, visitors) => {
    if (!visitors) return 0;
    return Math.round((purchases / visitors) * 100);
};

const forecastPoints = (dates, dailyTickets, extraDays = 8) => {
    const values = dates.map((iso) => dailyTickets[iso]?.tickets || 0);
    const recent = values.slice(-7);
    const mean = recent.reduce((sum, value) => sum + value, 0) / Math.max(recent.length, 1);
    const lastDate = dates[dates.length - 1];
    const lastValue = values[values.length - 1] || mean;
    const points = [{ x: lastDate, y: lastValue }];
    for (let step = 1; step <= extraDays; step += 1) {
        points.push({
            x: addDays(lastDate, step),
            y: Math.max(0, Math.round(mean + (lastValue - mean) * (1 - step / extraDays))),
        });
    }
    return points;
};

const eventChoices = () => [
    { id: 'all', name: 'All events' },
    ...ANALYTICS_EVENTS.map((event) => ({ id: event.id, name: event.name })),
];

/**
 * @param {{ eventId?: string, range?: string, href?: (path: string) => string }} filters
 */
export const selectAnalyticsDashboard = ({ eventId = DEFAULT_EVENT_ID, range = DEFAULT_RANGE, href = (path) => path } = {}) => {
    const rangeOption = DATE_RANGE_OPTIONS.find((option) => option.id === String(range)) || DATE_RANGE_OPTIONS[1];
    const days = rangeOption.days;
    const selectedEvent = ANALYTICS_EVENTS.find((event) => event.id === eventId) || null;
    const lookingAtAll = eventId === 'all' || !eventId;
    const empty = Boolean(selectedEvent?.empty);

    if (empty) {
        return {
            empty: true,
            emptyMessage: EMPTY_STATE_MESSAGE,
            eventId: selectedEvent.id,
            eventName: selectedEvent.name,
            range: rangeOption.id,
            rangeDays: days,
            events: eventChoices(),
            liveNow: null,
            headsUp: [],
            whatHappened: [],
            kpis: null,
            chart: null,
            pace: '',
            ticketPath: [],
            channels: [],
            channelTip: '',
        };
    }

    const sourceEvents = lookingAtAll
        ? ANALYTICS_EVENTS.filter((event) => !event.empty)
        : ANALYTICS_EVENTS.filter((event) => event.id === eventId);

    const ga4 = mergeGa4(sourceEvents.map((event) => EVENT_SOURCE[event.id].ga4));
    const sales = sourceEvents.flatMap((event) => EVENT_SOURCE[event.id].sales);
    const currentDates = dateWindow(MOCK_AS_OF, days);
    const priorDates = dateWindow(addDays(currentDates[0], -1), days);
    const currentTraffic = sumGa4(ga4, currentDates);
    const priorTraffic = sumGa4(ga4, priorDates);
    const currentSales = sumSales(sales, currentDates);
    const priorSales = sumSales(sales, priorDates);
    const copyKey = lookingAtAll ? 'all' : eventId;
    const copy = copyFor(copyKey, rangeOption.id);
    const livePeople = lookingAtAll
        ? ANALYTICS_EVENTS.filter((event) => !event.empty).reduce((sum, event) => sum + event.liveNow, 0)
        : selectedEvent.liveNow;
    const currentBought = boughtPer100(currentTraffic.ecommercePurchases, currentTraffic.activeUsers);
    const priorBought = boughtPer100(priorTraffic.ecommercePurchases, priorTraffic.activeUsers);

    sourceEvents.forEach((event) => {
        const eventSales = sumSales(EVENT_SOURCE[event.id].sales, currentDates);
        const eventTraffic = sumGa4(EVENT_SOURCE[event.id].ga4, currentDates);
        CHANNELS.forEach((channel) => {
            const share = eventTraffic.ecommercePurchases
                ? (eventTraffic.byChannel[channel.id].purchases / eventTraffic.ecommercePurchases)
                : 0;
            currentTraffic.byChannel[channel.id].tickets += Math.round(eventSales.tickets * share);
            currentTraffic.byChannel[channel.id].revenue = (currentTraffic.byChannel[channel.id].revenue || 0)
                + Math.round(eventSales.revenue * share);
        });
    });

    const channels = CHANNELS
        .map((channel) => ({
            id: channel.id,
            label: channel.label,
            visitors: currentTraffic.byChannel[channel.id].visitors,
            tickets: currentTraffic.byChannel[channel.id].tickets,
            revenue: currentTraffic.byChannel[channel.id].revenue || 0,
        }))
        .sort((left, right) => right.tickets - left.tickets || right.revenue - left.revenue);

    const pathSteps = [
        { id: 'viewed', label: 'Viewed event page', count: currentTraffic.screenPageViews },
        { id: 'picked', label: 'Picked tickets', count: currentTraffic.addToCarts },
        { id: 'checkout', label: 'Started checkout', count: currentTraffic.checkouts },
        { id: 'bought', label: 'Bought', count: currentTraffic.ecommercePurchases },
    ].map((step, index) => ({
        ...step,
        dropOff: copy.ticketPath[index],
    }));

    return {
        empty: false,
        emptyMessage: EMPTY_STATE_MESSAGE,
        eventId: lookingAtAll ? 'all' : selectedEvent.id,
        eventName: lookingAtAll ? 'All events' : selectedEvent.name,
        range: rangeOption.id,
        rangeDays: days,
        events: eventChoices(),
        liveNow: livePeople
            ? {
                people: livePeople,
                label: `${livePeople} people on your event page right now`,
            }
            : null,
        headsUp: copy.headsUp.map((card) => ({
            ...card,
            to: href(card.to),
        })),
        whatHappened: copy.whatHappened.map((text, index) => ({
            id: `happened-${index}`,
            text,
            to: href(index === 2 ? 'where-buyers-came-from' : 'ticket-path'),
        })),
        kpis: {
            ticketsSold: { current: currentSales.tickets, prior: priorSales.tickets },
            revenue: { current: currentSales.revenue, prior: priorSales.revenue },
            visitors: { current: currentTraffic.activeUsers, prior: priorTraffic.activeUsers },
            boughtPer100: { current: currentBought, prior: priorBought },
        },
        chart: {
            tickets: currentDates.map((iso) => ({ x: iso, y: currentSales.byDay[iso]?.tickets || 0 })),
            visitors: currentDates.map((iso) => ({ x: iso, y: currentTraffic.byDay[iso]?.visitors || 0 })),
            forecast: forecastPoints(currentDates, currentSales.byDay),
        },
        pace: copy.pace,
        ticketPath: pathSteps,
        channels,
        channelTip: copy.channelTip,
    };
};

export const listAnalyticsEvents = () => eventChoices();
