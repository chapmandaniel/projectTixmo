/**
 * Prototype-only GA4 mocks. Responses match Data API runReport / runRealtimeReport.
 * The adapter in ga4Adapter.js turns those rows into view models.
 *
 * @typedef {import('./ga4Adapter.js').Ga4RunReportResponse} Ga4RunReportResponse
 */

import {
    adaptGa4Report,
    emptyGa4Report,
    ga4DateToIso,
    isoToGa4Date,
    makeGa4Report,
    sumMetric,
    weightedAverage,
} from './ga4Adapter';
import { percentChange } from './formatters';

// Labs demo: the mock window ends today in America/St_Johns. Spike dates shift
// by the same number of days so the series stays current; copy uses the spike's weekday.
const MOCK_BASE_AS_OF = '2026-11-12';
const isoDateInStJohns = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/St_Johns',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const value = (type) => parts.find((part) => part.type === type)?.value;
    return `${value('year')}-${value('month')}-${value('day')}`;
};
export const MOCK_AS_OF = isoDateInStJohns();
const rollDays = (() => {
    const base = Date.UTC(2026, 10, 12);
    const [year, month, day] = MOCK_AS_OF.split('-').map(Number);
    const today = Date.UTC(year, month - 1, day);
    return Math.round((today - base) / 86400000);
})();
const rolled = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + rollDays));
    return date.toISOString().slice(0, 10);
};
export const weekdayLong = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
});
export const MOCK_PROMOTER = 'Northlight Live (demo)';
export const DEFAULT_PAGE_ID = 'aurora-after-dark';
export const DEFAULT_RANGE = '28';
export const EMPTY_STATE_MESSAGE = 'Not enough traffic yet to show trends.';

export const DATE_RANGE_OPTIONS = [
    { id: '7', short: '7 days', label: 'Last 7 days', days: 7 },
    { id: '28', short: '28 days', label: 'Last 28 days', days: 28 },
    { id: '90', short: '90 days', label: 'Last 90 days', days: 90 },
];


// Remaining Northlight Live seeded events (Labs demo). Purchases roughly follow
// the seed's order counts and sale windows; revenue is fictional test-mode CAD.
const EXTRA_ANALYTICS_PAGES = [
    { id: 'kitchen-party-social', name: 'Kitchen Party Social', path: '/events/kitchen-party-social', empty: false, liveNow: 47, festival: false },
    { id: 'late-show-comedy-club', name: 'Late Show Comedy Club', path: '/events/late-show-comedy-club', empty: false, liveNow: 11, festival: false },
    { id: 'saltwater-sessions-mara-vale', name: 'Saltwater Sessions: Mara Vale', path: '/events/saltwater-sessions-mara-vale', empty: false, liveNow: 8, festival: false },
    { id: 'iceberg-alley-jazz-brunch', name: 'Iceberg Alley Jazz Brunch', path: '/events/iceberg-alley-jazz-brunch', empty: false, liveNow: 5, festival: false },
    { id: 'new-years-eve-at-harbourfront', name: "New Year's Eve at Harbourfront", path: '/events/new-years-eve-at-harbourfront', empty: false, liveNow: 16, festival: false },
    { id: 'battery-road-blues-night', name: 'Battery Road Blues Night', path: '/events/battery-road-blues-night', empty: false, liveNow: 4, festival: false },
    { id: 'northern-static-live', name: 'Northern Static Live', path: '/events/northern-static-live', empty: false, liveNow: 1, festival: false },
    { id: 'signal-hill-sunset-sessions', name: 'Signal Hill Sunset Sessions', path: '/events/signal-hill-sunset-sessions', empty: false, liveNow: 0, festival: true },
    { id: 'halloween-masquerade', name: 'Halloween Masquerade', path: '/events/halloween-masquerade', empty: false, liveNow: 2, festival: false },
    { id: 'duckworth-indie-weekender', name: 'Duckworth Indie Weekender', path: '/events/duckworth-indie-weekender', empty: false, liveNow: 0, festival: true },
    { id: 'ember-choir-winter-songs', name: 'Ember Choir: Winter Songs', path: '/events/ember-choir-winter-songs', empty: false, liveNow: 3, festival: false },
    { id: 'winter-lanterns-gala', name: 'Winter Lanterns Gala', path: '/events/winter-lanterns-gala', empty: false, liveNow: 6, festival: false },
    { id: 'tidewater-film-score-live', name: 'Tidewater Film Score Live', path: '/events/tidewater-film-score-live', empty: false, liveNow: 4, festival: false },
    { id: 'spring-tide-sessions', name: 'Spring Tide Sessions', path: '/events/spring-tide-sessions', empty: false, liveNow: 1, festival: false },
    { id: 'solstice-block-party', name: 'Solstice Block Party', path: '/events/solstice-block-party', empty: false, liveNow: 1, festival: true },
];

export const ANALYTICS_PAGES = [
    { id: 'all', name: 'All pages', path: null, empty: false, liveNow: 94 },
    {
        id: 'aurora-after-dark',
        name: 'Aurora After Dark',
        path: '/events/aurora-after-dark',
        empty: false,
        liveNow: 23,
        festival: false,
    },
    {
        id: 'harbour-lights-festival',
        name: 'Harbour Lights Festival',
        path: '/events/harbour-lights-festival',
        empty: false,
        liveNow: 61,
        festival: true,
    },
    {
        id: 'fog-city-strobe',
        name: 'Fog City Strobe',
        path: '/events/fog-city-strobe',
        empty: false,
        liveNow: 8,
        festival: false,
    },
    {
        id: 'quiet-harbour-acoustic',
        name: 'Quiet Harbour Acoustic',
        path: '/events/quiet-harbour-acoustic',
        empty: false,
        liveNow: 2,
        festival: false,
    },
    ...EXTRA_ANALYTICS_PAGES,
];
ANALYTICS_PAGES[0].liveNow = ANALYTICS_PAGES.filter((page) => page.id !== 'all').reduce((sum, page) => sum + (page.liveNow || 0), 0);

export const CHANNELS = [
    { id: 'organic-search', label: 'Organic Search' },
    { id: 'direct', label: 'Direct' },
    { id: 'paid-social', label: 'Paid Social' },
    { id: 'organic-social', label: 'Organic Social' },
    { id: 'email', label: 'Email' },
    { id: 'referral', label: 'Referral' },
];

export const DEVICE_CATEGORIES = ['desktop', 'mobile', 'tablet'];

export const FUNNEL_EVENTS = [
    { id: 'view_item', label: 'Viewed item' },
    { id: 'add_to_cart', label: 'Added to cart' },
    { id: 'begin_checkout', label: 'Started checkout' },
    { id: 'purchase', label: 'Purchased' },
];

const DAILY_DIMS = ['date', 'pagePath'];
const DAILY_METRICS = ['activeUsers', 'screenPageViews', 'averageSessionDuration', 'ecommercePurchases', 'purchaseRevenue'];
const CHANNEL_DIMS = ['date', 'pagePath', 'sessionDefaultChannelGroup'];
const CHANNEL_METRICS = ['activeUsers', 'ecommercePurchases'];
const PAGE_DIMS = ['date', 'pagePath', 'pageTitle'];
const PAGE_METRICS = ['screenPageViews'];
const EVENT_DIMS = ['date', 'pagePath', 'eventName'];
const EVENT_METRICS = ['eventCount', 'purchaseRevenue'];
const DEVICE_DIMS = ['date', 'pagePath', 'deviceCategory'];
const DEVICE_METRICS = ['activeUsers'];
const CITY_DIMS = ['date', 'pagePath', 'city'];
const CITY_METRICS = ['activeUsers'];
const REALTIME_DIMS = ['unifiedScreenName'];
const REALTIME_METRICS = ['activeUsers'];

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
const dateWindow = (endIso, days) => {
    const dates = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) dates.push(addDays(endIso, -offset));
    return dates;
};

const roundPreserveSum = (values, total) => {
    const floored = values.map((value) => Math.floor(value));
    let remainder = Math.round(total) - floored.reduce((sum, value) => sum + value, 0);
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
        const weekend = weekday === 5 || weekday === 6 ? 1.3 : 1;
        const spike = iso === spikeDate ? spikeFactor : 1;
        return Math.max(0.35, weekend * spike);
    });
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    return roundPreserveSum(weights.map((weight) => (weight / weightSum) * total), total);
};

const splitByShare = (total, shares) => roundPreserveSum(shares.map((share) => total * share), total);

const PAGE_PERIODS = {
    'aurora-after-dark': {
        spikeDate: rolled('2026-11-10'),
        spikeFactor: 2.2,
        durationSeconds: 102,
        priorDurationSeconds: 90,
        mix: { 'organic-social': 0.34, 'paid-social': 0.16, 'organic-search': 0.18, email: 0.14, direct: 0.12, referral: 0.06 },
        devices: { desktop: 0.52, mobile: 0.41, tablet: 0.07 },
        cities: { "St. John's": 0.48, 'Mount Pearl': 0.18, Halifax: 0.14, Toronto: 0.12, 'Corner Brook': 0.08 },
        current: {
            7: { visitors: 410, views: 860, purchases: 28, viewItem: 320, carts: 96, checkouts: 54, revenue: 2402 },
            28: { visitors: 1180, views: 2460, purchases: 118, viewItem: 1210, carts: 340, checkouts: 198, revenue: 10437 },
            90: { visitors: 2740, views: 5680, purchases: 248, viewItem: 2680, carts: 720, checkouts: 410, revenue: 22965 },
        },
        prior: {
            7: { visitors: 380, views: 790, purchases: 24, viewItem: 290, carts: 84, checkouts: 48, revenue: 2695 },
            28: { visitors: 1000, views: 2100, purchases: 92, viewItem: 1040, carts: 280, checkouts: 170, revenue: 10051 },
            90: { visitors: 2320, views: 4860, purchases: 196, viewItem: 2240, carts: 610, checkouts: 350, revenue: 23033 },
        },
        extraPages: [
            { path: '/events/aurora-after-dark', title: 'Aurora After Dark', share: 0.52, trend: 'up' },
            { path: '/events/aurora-after-dark/tickets', title: 'Aurora After Dark tickets', share: 0.22, trend: 'up' },
            { path: '/checkout/aurora-after-dark', title: 'Checkout', share: 0.16, trend: 'down' },
            { path: '/events/aurora-after-dark/lineup', title: 'Lineup', share: 0.1, trend: 'flat' },
        ],
        tips: {
            'organic-social': 'Lineup posts on Organic Social still open the door.',
            'paid-social': 'Paid Social is catching up this month.',
            'organic-search': 'Search visitors stay late on the lineup page.',
            email: 'Email visitors purchase more often than the rest.',
            direct: 'People who type the address still know the night.',
            referral: 'Referral traffic is small but steady.',
        },
    },
    'harbour-lights-festival': {
        spikeDate: rolled('2026-11-08'),
        spikeFactor: 1.8,
        durationSeconds: 135,
        priorDurationSeconds: 118,
        mix: { 'organic-social': 0.22, 'paid-social': 0.28, 'organic-search': 0.2, email: 0.12, direct: 0.12, referral: 0.06 },
        devices: { desktop: 0.44, mobile: 0.5, tablet: 0.06 },
        cities: { "St. John's": 0.42, Halifax: 0.22, Toronto: 0.16, 'Mount Pearl': 0.12, Montreal: 0.08 },
        current: {
            7: { visitors: 1920, views: 3840, purchases: 164, viewItem: 2140, carts: 610, checkouts: 390, revenue: 27206 },
            28: { visitors: 6840, views: 12100, purchases: 540, viewItem: 7480, carts: 1980, checkouts: 1280, revenue: 112851 },
            90: { visitors: 9420, views: 16840, purchases: 730, viewItem: 10210, carts: 2680, checkouts: 1720, revenue: 158671 },
        },
        prior: {
            7: { visitors: 1610, views: 3180, purchases: 122, viewItem: 1780, carts: 490, checkouts: 310, revenue: 36279 },
            28: { visitors: 5120, views: 9640, purchases: 380, viewItem: 5610, carts: 1480, checkouts: 940, revenue: 115273 },
            90: { visitors: 7210, views: 13200, purchases: 490, viewItem: 7820, carts: 2010, checkouts: 1280, revenue: 141518 },
        },
        extraPages: [
            { path: '/events/harbour-lights-festival', title: 'Harbour Lights Festival', share: 0.48, trend: 'up' },
            { path: '/events/harbour-lights-festival/passes', title: 'Weekend passes', share: 0.24, trend: 'up' },
            { path: '/checkout/harbour-lights-festival', title: 'Checkout', share: 0.18, trend: 'flat' },
            { path: '/events/harbour-lights-festival/lineup', title: 'Saturday lineup', share: 0.1, trend: 'up' },
        ],
        tips: {
            'organic-social': 'Organic Social still introduces the festival.',
            'paid-social': 'Paid Social is the fastest-growing door in.',
            'organic-search': 'Search is finding the Saturday lineup.',
            email: 'The early-bird note still pays off.',
            direct: 'Direct visits pick up on lineup days.',
            referral: 'Partner sites send a little traffic each week.',
        },
    },
    'fog-city-strobe': {
        spikeDate: rolled('2026-11-07'),
        spikeFactor: 1.5,
        durationSeconds: 78,
        priorDurationSeconds: 90,
        mix: { 'organic-social': 0.14, 'paid-social': 0.1, 'organic-search': 0.12, email: 0.08, direct: 0.46, referral: 0.1 },
        devices: { desktop: 0.38, mobile: 0.54, tablet: 0.08 },
        cities: { 'Mount Pearl': 0.36, "St. John's": 0.32, Halifax: 0.14, Toronto: 0.1, Gander: 0.08 },
        current: {
            7: { visitors: 220, views: 410, purchases: 12, viewItem: 180, carts: 48, checkouts: 28, revenue: 2159 },
            28: { visitors: 980, views: 1860, purchases: 40, viewItem: 820, carts: 210, checkouts: 118, revenue: 6944 },
            90: { visitors: 1680, views: 3120, purchases: 74, viewItem: 1420, carts: 360, checkouts: 198, revenue: 12683 },
        },
        prior: {
            7: { visitors: 260, views: 470, purchases: 16, viewItem: 210, carts: 58, checkouts: 34, revenue: 2720 },
            28: { visitors: 1100, views: 2040, purchases: 52, viewItem: 910, carts: 248, checkouts: 140, revenue: 8784 },
            90: { visitors: 1840, views: 3380, purchases: 88, viewItem: 1560, carts: 410, checkouts: 230, revenue: 13395 },
        },
        extraPages: [
            { path: '/events/fog-city-strobe', title: 'Fog City Strobe', share: 0.58, trend: 'down' },
            { path: '/events/fog-city-strobe/tickets', title: 'Fog City tickets', share: 0.2, trend: 'down' },
            { path: '/checkout/fog-city-strobe', title: 'Checkout', share: 0.14, trend: 'down' },
            { path: '/events/fog-city-strobe/info', title: 'Door info', share: 0.08, trend: 'flat' },
        ],
        tips: {
            'organic-social': 'Social looks are not turning into purchases yet.',
            'paid-social': 'Paid Social is quiet for this night.',
            'organic-search': 'Search is a small, steady trickle.',
            email: 'A reminder note could still help.',
            direct: 'Most people already know the address.',
            referral: 'Friends of friends arrive from other sites.',
        },
    },
    // Labs demo: purchases and revenue match the seeded test orders for this completed show.
    'quiet-harbour-acoustic': {
        spikeDate: rolled('2026-11-06'),
        spikeFactor: 2.4,
        durationSeconds: 84,
        priorDurationSeconds: 60,
        mix: { 'organic-social': 0.2, 'paid-social': 0.04, 'organic-search': 0.16, email: 0.32, direct: 0.22, referral: 0.06 },
        devices: { desktop: 0.48, mobile: 0.46, tablet: 0.06 },
        cities: { "St. John's": 0.62, 'Mount Pearl': 0.16, Paradise: 0.1, 'Corner Brook': 0.07, Halifax: 0.05 },
        current: {
            7: { visitors: 140, views: 230, purchases: 0, viewItem: 40, carts: 0, checkouts: 0, revenue: 0 },
            28: { visitors: 640, views: 1210, purchases: 46, viewItem: 420, carts: 120, checkouts: 70, revenue: 4717 },
            90: { visitors: 1520, views: 2860, purchases: 128, viewItem: 1010, carts: 310, checkouts: 190, revenue: 14564 },
        },
        prior: {
            7: { visitors: 20, views: 30, purchases: 0, viewItem: 4, carts: 0, checkouts: 0, revenue: 0 },
            28: { visitors: 60, views: 90, purchases: 0, viewItem: 12, carts: 0, checkouts: 0, revenue: 0 },
            90: { visitors: 120, views: 180, purchases: 0, viewItem: 24, carts: 0, checkouts: 0, revenue: 0 },
        },
        extraPages: [
            { path: '/events/quiet-harbour-acoustic', title: 'Quiet Harbour Acoustic', share: 0.5, trend: 'down' },
            { path: '/events/quiet-harbour-acoustic/photos', title: 'Show photos', share: 0.24, trend: 'up' },
            { path: '/checkout/quiet-harbour-acoustic', title: 'Checkout', share: 0.16, trend: 'down' },
            { path: '/events/quiet-harbour-acoustic/setlist', title: 'Setlist', share: 0.1, trend: 'up' },
        ],
        tips: {
            'organic-social': 'Show photos brought people back after the night.',
            'paid-social': 'No paid push for this seated show.',
            'organic-search': 'Search finds the setlist page.',
            email: 'The mailing list sold most of the seats.',
            direct: 'Regulars come straight to the page.',
            referral: 'The venue site sends a few visitors.',
        },
    },
};

const eventPages = (id, name, extras = {}) => ([
    { path: `/events/${id}`, title: name, share: 0.54, trend: extras.trend || 'up' },
    { path: `/events/${id}/tickets`, title: `${name} tickets`, share: 0.22, trend: extras.ticketTrend || 'flat' },
    { path: `/checkout/${id}`, title: 'Checkout', share: 0.16, trend: extras.checkoutTrend || 'flat' },
    { path: extras.infoPath || `/events/${id}/info`, title: extras.infoTitle || 'Event info', share: 0.08, trend: 'flat' },
]);

const defaultTips = (note) => ({
    'organic-social': note || 'Organic Social is the usual first look.',
    'paid-social': 'Paid Social is a smaller door in for this page.',
    'organic-search': 'Search is a steady trickle.',
    email: 'The mailing list still converts better than the rest.',
    direct: 'Regulars type the address.',
    referral: 'Partner sites send a little traffic.',
});

const bands = (c7, c28, c90, p7, p28, p90, avgPrice) => {
    const row = (purchases, visitors, views, viewItem, carts, checkouts, revenue) => ({
        visitors, views, purchases, viewItem, carts, checkouts, revenue,
    });
    const shape = (purchases, scale) => {
        const visitors = Math.round(purchases * scale.v);
        const views = Math.round(visitors * scale.views);
        const viewItem = Math.round(Math.max(purchases * 3.2, visitors * 0.7));
        const carts = Math.round(purchases * 2.6);
        const checkouts = Math.round(purchases * 1.6);
        const revenue = Math.round(purchases * avgPrice);
        return row(purchases, visitors, views, viewItem, carts, checkouts, revenue);
    };
    const hot = { v: 8.4, views: 2.05 };
    const cool = { v: 14, views: 1.9 };
    const zero = (visitors) => row(0, visitors, Math.round(visitors * 1.7), Math.round(visitors * 0.4), 0, 0, 0);
    const neverSold = c90 === 0 && p90 === 0;
    const scaleFor = (purchases, window) => {
        if (window.startsWith('prior')) return cool;
        return hot;
    };
    return {
        current: {
            7: c7 === 0 ? zero(neverSold ? 48 : Math.max(16, Math.round((c28 || c90) * 0.05) || 16)) : shape(c7, scaleFor(c7, 'current7')),
            28: c28 === 0 ? zero(neverSold ? 160 : Math.max(40, Math.round((c90) * 0.08) || 40)) : shape(c28, scaleFor(c28, 'current28')),
            90: c90 === 0 ? zero(neverSold ? 240 : 80) : shape(c90, scaleFor(c90, 'current90')),
        },
        prior: {
            7: p7 === 0 ? zero(neverSold ? 12 : Math.max(10, Math.round((p28 || p90) * 0.04) || 10)) : shape(p7, scaleFor(p7, 'prior7')),
            28: p28 === 0 ? zero(neverSold ? 30 : Math.max(20, Math.round((p90) * 0.06) || 20)) : shape(p28, scaleFor(p28, 'prior28')),
            90: p90 === 0 ? zero(neverSold ? 60 : 40) : shape(p90, scaleFor(p90, 'prior90')),
        },
    };
};

const extraPeriod = (id, name, spike, factor, duration, priorDuration, mix, devices, cities, purchaseBands, avgPrice, tips, pageExtras) => {
    const built = bands(...purchaseBands, avgPrice);
    return {
        spikeDate: rolled(spike),
        spikeFactor: factor,
        durationSeconds: duration,
        priorDurationSeconds: priorDuration,
        mix,
        devices,
        cities,
        current: built.current,
        prior: built.prior,
        extraPages: eventPages(id, name, pageExtras),
        tips: tips || defaultTips(),
    };
};

const MIX_SOCIAL = { 'organic-social': 0.32, 'paid-social': 0.14, 'organic-search': 0.16, email: 0.16, direct: 0.16, referral: 0.06 };
const MIX_PAID = { 'organic-social': 0.18, 'paid-social': 0.3, 'organic-search': 0.16, email: 0.12, direct: 0.16, referral: 0.08 };
const MIX_EMAIL = { 'organic-social': 0.16, 'paid-social': 0.06, 'organic-search': 0.14, email: 0.36, direct: 0.22, referral: 0.06 };
const MIX_DIRECT = { 'organic-social': 0.12, 'paid-social': 0.08, 'organic-search': 0.12, email: 0.1, direct: 0.48, referral: 0.1 };
const DEV_EVEN = { desktop: 0.46, mobile: 0.48, tablet: 0.06 };
const DEV_MOBILE = { desktop: 0.36, mobile: 0.58, tablet: 0.06 };
const CITY_LOCAL = { "St. John's": 0.54, 'Mount Pearl': 0.18, Paradise: 0.1, Halifax: 0.1, 'Corner Brook': 0.08 };
const CITY_WIDE = { "St. John's": 0.4, Halifax: 0.2, Toronto: 0.16, 'Mount Pearl': 0.14, Montreal: 0.1 };

Object.assign(PAGE_PERIODS, {
    'kitchen-party-social': extraPeriod(
        'kitchen-party-social', 'Kitchen Party Social', '2026-11-12', 2.6, 96, 80, MIX_SOCIAL, DEV_MOBILE, CITY_LOCAL,
        [80, 175, 175, 20, 40, 40], 38,
        {
            'organic-social': 'Tonight’s kitchen party is all over Organic Social.',
            'paid-social': 'A small boost is still running for walk-up tickets.',
            'organic-search': 'People are searching for doors and the set list.',
            email: 'The reminder note went out this afternoon.',
            direct: 'Locals already know the Battery Club address.',
            referral: 'The venue page is sending last-minute visitors.',
        },
        { trend: 'up', ticketTrend: 'up', infoTitle: 'Doors and set' }
    ),
    'late-show-comedy-club': extraPeriod(
        'late-show-comedy-club', 'Late Show Comedy Club', '2026-11-09', 1.7, 88, 84, MIX_PAID, DEV_EVEN, CITY_LOCAL,
        [22, 280, 400, 40, 120, 120], 42, defaultTips('The sold-out late show still gets a few waitlist visits.'),
        { ticketTrend: 'down', infoTitle: 'Waitlist' }
    ),
    'saltwater-sessions-mara-vale': extraPeriod(
        'saltwater-sessions-mara-vale', 'Saltwater Sessions: Mara Vale', '2026-11-12', 1.6, 110, 96, MIX_EMAIL, DEV_EVEN, CITY_LOCAL,
        [25, 105, 105, 8, 18, 18], 52, defaultTips('The seated session is selling quietly through the list.'),
        { infoTitle: 'Set and Q&A' }
    ),
    'iceberg-alley-jazz-brunch': extraPeriod(
        'iceberg-alley-jazz-brunch', 'Iceberg Alley Jazz Brunch', '2026-11-08', 1.5, 92, 86, MIX_SOCIAL, DEV_MOBILE, CITY_LOCAL,
        [22, 70, 70, 10, 16, 16], 58, defaultTips('Brunch seat posts are doing the work.'),
        { infoTitle: 'Menu and trio' }
    ),
    'new-years-eve-at-harbourfront': extraPeriod(
        'new-years-eve-at-harbourfront', "New Year's Eve at Harbourfront", '2026-11-05', 1.9, 124, 108, MIX_PAID, DEV_MOBILE, CITY_WIDE,
        [40, 180, 520, 60, 200, 280], 98, defaultTips('The NYE countdown campaign is the long lead.'),
        { infoTitle: 'Rooms and fireworks', festival: true }
    ),
    'battery-road-blues-night': extraPeriod(
        'battery-road-blues-night', 'Battery Road Blues Night', '2026-11-11', 1.4, 80, 74, MIX_DIRECT, DEV_EVEN, CITY_LOCAL,
        [18, 48, 48, 4, 8, 8], 32, defaultTips('Regulars already know the night.'),
        { infoTitle: 'Doors at 8' }
    ),
    'northern-static-live': extraPeriod(
        'northern-static-live', 'Northern Static Live', '2026-10-16', 2.0, 90, 100, MIX_SOCIAL, DEV_MOBILE, CITY_WIDE,
        [0, 0, 400, 0, 80, 760], 52,
        defaultTips('People come back for photos of the homecoming show.'),
        { trend: 'down', ticketTrend: 'down', infoTitle: 'Show photos' }
    ),
    'signal-hill-sunset-sessions': extraPeriod(
        'signal-hill-sunset-sessions', 'Signal Hill Sunset Sessions', '2026-09-15', 1.8, 100, 110, MIX_SOCIAL, DEV_MOBILE, CITY_WIDE,
        [0, 0, 200, 0, 0, 700], 48,
        defaultTips('The hill show is now a recap page.'),
        { trend: 'down', infoTitle: 'Photos' }
    ),
    'halloween-masquerade': extraPeriod(
        'halloween-masquerade', 'Halloween Masquerade', '2026-10-31', 2.3, 95, 88, MIX_PAID, DEV_MOBILE, CITY_WIDE,
        [0, 400, 640, 0, 80, 80], 55,
        defaultTips('Costume photos still pull a few visits after the night.'),
        { trend: 'down', infoTitle: 'Costume gallery' }
    ),
    'duckworth-indie-weekender': extraPeriod(
        'duckworth-indie-weekender', 'Duckworth Indie Weekender', '2026-08-20', 1.6, 118, 120, MIX_SOCIAL, DEV_MOBILE, CITY_WIDE,
        [0, 0, 80, 0, 0, 700], 92,
        defaultTips('The weekender page is mostly an archive now.'),
        { trend: 'flat', infoTitle: 'Lineup archive' }
    ),
    'ember-choir-winter-songs': extraPeriod(
        'ember-choir-winter-songs', 'Ember Choir: Winter Songs', '2026-11-09', 2.1, 86, 70, MIX_EMAIL, DEV_EVEN, CITY_LOCAL,
        [40, 240, 240, 0, 10, 10], 48,
        defaultTips('The candlelit choir night just wrapped.'),
        { trend: 'down', infoTitle: 'Program' }
    ),
    'winter-lanterns-gala': extraPeriod(
        'winter-lanterns-gala', 'Winter Lanterns Gala', '2026-11-11', 1.3, 104, 70, MIX_EMAIL, DEV_EVEN, CITY_WIDE,
        [0, 0, 0, 0, 0, 0], 180,
        defaultTips('The gala page is up; tickets go on sale in a few days.'),
        { infoTitle: 'Patron tables' }
    ),
    'tidewater-film-score-live': extraPeriod(
        'tidewater-film-score-live', 'Tidewater Film Score Live', '2026-11-07', 1.2, 112, 80, MIX_SOCIAL, DEV_EVEN, CITY_WIDE,
        [0, 0, 0, 0, 0, 0], 72,
        defaultTips('The announcement is circulating; tickets are not on sale yet.'),
        { infoTitle: 'Orchestra seating' }
    ),
    'spring-tide-sessions': extraPeriod(
        'spring-tide-sessions', 'Spring Tide Sessions', '2026-11-04', 1.1, 70, 60, MIX_DIRECT, DEV_EVEN, CITY_LOCAL,
        [0, 0, 0, 0, 0, 0], 28,
        defaultTips('A quiet draft page for the spring series.'),
        { trend: 'flat', infoTitle: 'Series notes' }
    ),
    'solstice-block-party': extraPeriod(
        'solstice-block-party', 'Solstice Block Party', '2026-11-02', 1.1, 80, 60, MIX_SOCIAL, DEV_MOBILE, CITY_WIDE,
        [0, 0, 0, 0, 0, 0], 45,
        defaultTips('Early interest in the longest-day block party.'),
        { trend: 'flat', infoTitle: 'Street plan' }
    ),
});


const KEYS = ['visitors', 'views', 'purchases', 'viewItem', 'carts', 'checkouts', 'revenue'];

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
            byDate[iso] = Object.fromEntries(KEYS.map((key) => [key, 0]));
        });
        KEYS.forEach((key) => {
            const late = spreadAcrossDays(totals[7][key], last7, spikeDate, spikeFactor);
            const mid = spreadAcrossDays(totals[28][key] - totals[7][key], mid21, spikeDate, spikeFactor);
            const old = spreadAcrossDays(totals[90][key] - totals[28][key], early, spikeDate, 1);
            last7.forEach((iso, index) => { byDate[iso][key] = late[index] || 0; });
            mid21.forEach((iso, index) => { byDate[iso][key] = mid[index] || 0; });
            early.forEach((iso, index) => { byDate[iso][key] = old[index] || 0; });
        });
        return byDate;
    };
    return { current: build(current90, current), prior: build(prior90, prior) };
};

const buildPageSource = (page, config) => {
    const series = bandedDaily(config.current, config.prior, config.spikeDate, config.spikeFactor);
    const byDate = { ...series.prior, ...series.current };
    const current90 = dateWindow(MOCK_AS_OF, 90);
    const dailyRecords = [];
    const channelRecords = [];
    const pageRecords = [];
    const eventRecords = [];
    const deviceRecords = [];
    const cityRecords = [];

    Object.entries(byDate).forEach(([iso, metrics]) => {
        const ga4Date = isoToGa4Date(iso);
        const duration = current90.includes(iso) ? config.durationSeconds : config.priorDurationSeconds;
        dailyRecords.push({
            date: ga4Date,
            pagePath: page.path,
            activeUsers: metrics.visitors,
            screenPageViews: metrics.views,
            averageSessionDuration: duration,
            ecommercePurchases: metrics.purchases,
            purchaseRevenue: metrics.revenue,
        });
        const channelVisitors = splitByShare(metrics.visitors, CHANNELS.map((channel) => config.mix[channel.id]));
        const channelPurchases = splitByShare(metrics.purchases, CHANNELS.map((channel) => config.mix[channel.id]));
        CHANNELS.forEach((channel, index) => {
            channelRecords.push({
                date: ga4Date,
                pagePath: page.path,
                sessionDefaultChannelGroup: channel.label,
                activeUsers: channelVisitors[index],
                ecommercePurchases: channelPurchases[index],
            });
        });
        const pageViews = splitByShare(metrics.views, config.extraPages.map((item) => item.share));
        config.extraPages.forEach((item, index) => {
            pageRecords.push({
                date: ga4Date,
                pagePath: item.path,
                pageTitle: item.title,
                screenPageViews: pageViews[index],
            });
        });
        const eventCounts = [metrics.viewItem, metrics.carts, metrics.checkouts, metrics.purchases];
        FUNNEL_EVENTS.forEach((event, index) => {
            eventRecords.push({
                date: ga4Date,
                pagePath: page.path,
                eventName: event.id,
                eventCount: eventCounts[index],
                purchaseRevenue: event.id === 'purchase' ? metrics.revenue : 0,
            });
        });
        const deviceUsers = splitByShare(metrics.visitors, DEVICE_CATEGORIES.map((id) => config.devices[id]));
        DEVICE_CATEGORIES.forEach((device, index) => {
            deviceRecords.push({
                date: ga4Date,
                pagePath: page.path,
                deviceCategory: device,
                activeUsers: deviceUsers[index],
            });
        });
        const cityNames = Object.keys(config.cities);
        const cityUsers = splitByShare(metrics.visitors, cityNames.map((name) => config.cities[name]));
        cityNames.forEach((city, index) => {
            cityRecords.push({
                date: ga4Date,
                pagePath: page.path,
                city,
                activeUsers: cityUsers[index],
            });
        });
    });

    return {
        daily: makeGa4Report(DAILY_DIMS, DAILY_METRICS, dailyRecords),
        channels: makeGa4Report(CHANNEL_DIMS, CHANNEL_METRICS, channelRecords),
        pages: makeGa4Report(PAGE_DIMS, PAGE_METRICS, pageRecords),
        events: makeGa4Report(EVENT_DIMS, EVENT_METRICS, eventRecords),
        devices: makeGa4Report(DEVICE_DIMS, DEVICE_METRICS, deviceRecords),
        cities: makeGa4Report(CITY_DIMS, CITY_METRICS, cityRecords),
        realtime: makeGa4Report(REALTIME_DIMS, REALTIME_METRICS, [
            { unifiedScreenName: page.path, activeUsers: page.liveNow },
        ]),
        extraPages: config.extraPages,
        tips: config.tips,
    };
};

const emptySource = (page) => ({
    daily: emptyGa4Report(DAILY_DIMS, DAILY_METRICS),
    channels: emptyGa4Report(CHANNEL_DIMS, CHANNEL_METRICS),
    pages: emptyGa4Report(PAGE_DIMS, PAGE_METRICS),
    events: emptyGa4Report(EVENT_DIMS, EVENT_METRICS),
    devices: emptyGa4Report(DEVICE_DIMS, DEVICE_METRICS),
    cities: emptyGa4Report(CITY_DIMS, CITY_METRICS),
    realtime: emptyGa4Report(REALTIME_DIMS, REALTIME_METRICS),
    extraPages: [{ path: page.path, title: page.name, share: 1, trend: 'flat' }],
    tips: {},
});

/** @type {Record<string, ReturnType<typeof buildPageSource>>} */
export const GA4_SOURCES = Object.fromEntries(
    ANALYTICS_PAGES.filter((page) => page.id !== 'all').map((page) => [
        page.id,
        page.empty ? emptySource(page) : buildPageSource(page, PAGE_PERIODS[page.id]),
    ])
);

const AI_COPY = {
    'aurora-after-dark': {
        7: {
            whatHappened: [
                'This week is quieter than last week after Tuesday’s Organic Social rush.',
                'Paid Social is still a small slice of visitors.',
                'Checkout is the sticky step: people add to cart, then leave.',
            ],
            headsUp: [
                { id: 'drop', title: 'Traffic dipped after Tuesday', reason: 'Visitors fell once the lineup post aged off.', to: '#where-visitors' },
                { id: 'checkout', title: 'Checkout drop-off is up', reason: 'More people leave after they start checkout.', to: '#ticket-path' },
            ],
        },
        28: {
            whatHappened: [
                'Visitors jumped Tuesday after the lineup went up on Organic Social.',
                'Paid Social is bringing more people this month than last.',
                'Direct traffic stays steady, and those visitors still purchase more often.',
            ],
            headsUp: [
                { id: 'spike', title: 'Traffic spiked on Tuesday', reason: 'Organic Social jumped after the lineup post.', to: '#where-visitors' },
                { id: 'source', title: 'Paid Social is growing fast', reason: 'Paid Social visitors are ahead of last period.', to: '#where-visitors' },
                { id: 'checkout', title: 'Checkout drop-off is high', reason: 'About 40% leave after they start checkout.', to: '#ticket-path' },
            ],
        },
        90: {
            whatHappened: [
                'Organic Social has led visitors for three months.',
                'Search grew slowly, then purchases followed in November.',
                'Email is a smaller door in, with a longer time on site.',
            ],
            headsUp: [
                { id: 'checkout', title: 'Checkout drop-off is high', reason: 'Checkout has been the sticky step all fall.', to: '#ticket-path' },
            ],
        },
    },
    'harbour-lights-festival': {
        7: {
            whatHappened: [
                'Paid Social led this week after the Saturday lineup ad.',
                'Mobile visitors outpaced desktop every day.',
                'Search traffic followed the ad, then purchases came later that night.',
            ],
            headsUp: [
                { id: 'source', title: 'Paid Social is growing fast', reason: 'Paid Social is the biggest door in this week.', to: '#where-visitors' },
            ],
        },
        28: {
            whatHappened: [
                'Festival visitors rose after the Saturday lineup went public.',
                'Paid Social now brings in more people than Organic Social.',
                'Search still finds the lineup page, then people move to checkout.',
            ],
            headsUp: [
                { id: 'spike', title: 'Traffic spiked on lineup day', reason: 'Visitors jumped when the Saturday lineup posted.', to: '#where-visitors' },
                { id: 'source', title: 'Paid Social is growing fast', reason: 'Paid Social overtook Organic Social this period.', to: '#where-visitors' },
                { id: 'checkout', title: 'Checkout drop-off is up', reason: 'Weekend-pass checkout loses people late at night.', to: '#ticket-path' },
            ],
        },
        90: {
            whatHappened: [
                'The festival built slowly, then jumped when the full lineup went up.',
                'Paid Social has been the main new door in since October.',
                'Email from the early-bird note still brings purchases.',
            ],
            headsUp: [
                { id: 'source', title: 'Paid Social is growing fast', reason: 'Paid Social has led new visitors since October.', to: '#where-visitors' },
            ],
        },
    },
    'fog-city-strobe': {
        7: {
            whatHappened: [
                'Direct visits still lead, but this week is softer than last.',
                'Social looks are not turning into purchases.',
                'Checkout drop-off ticked up on Thursday.',
            ],
            headsUp: [
                { id: 'drop', title: 'Traffic is down this week', reason: 'Fewer people opened the page than last week.', to: '#where-visitors' },
                { id: 'checkout', title: 'Checkout drop-off is up', reason: 'People add to cart, then leave before they pay.', to: '#ticket-path' },
            ],
        },
        28: {
            whatHappened: [
                'Most visitors typed the page directly.',
                'Social and search together still trail Direct.',
                'Traffic cooled after the first announcement week.',
            ],
            headsUp: [
                { id: 'drop', title: 'Traffic is down vs last period', reason: 'Fewer people visited than the previous 28 days.', to: '#where-visitors' },
                { id: 'checkout', title: 'Checkout drop-off is high', reason: 'A large share leave after they start checkout.', to: '#ticket-path' },
            ],
        },
        90: {
            whatHappened: [
                'Fog City stays a Direct-visit page.',
                'The first announcement week was the high point.',
                'Social brings looks, but they rarely purchase.',
            ],
            headsUp: [
                { id: 'drop', title: 'Traffic never matched the first week', reason: 'Visits settled after the announcement burst.', to: '#where-visitors' },
            ],
        },
    },
    'quiet-harbour-acoustic': {
        7: {
            whatHappened: [
                'The show is over, so this week is people looking back at photos and the setlist.',
                'No purchases this week, as expected after the night.',
                'Email readers were the most likely to open the recap.',
            ],
            headsUp: [
                { id: 'drop', title: 'Sales closed after the show', reason: 'Visitors now come for photos, not tickets.', to: '#where-visitors' },
            ],
        },
        28: {
            whatHappened: [
                'Visits peaked on show day, then turned into photo views.',
                'Email sold most of the seats in the last three weeks.',
                'Checkout drop-off stayed low for this small seated room.',
            ],
            headsUp: [
                { id: 'spike', title: 'Traffic spiked on show day', reason: 'Door-time questions and last-minute seats.', to: '#where-visitors' },
            ],
        },
        90: {
            whatHappened: [
                'A steady mailing-list sell for a 300-seat room.',
                'Most buyers were local to St. John\'s.',
                'Search found the setlist after the show.',
            ],
            headsUp: [
                { id: 'source', title: 'Email led sales', reason: 'The mailing list was the biggest door in.', to: '#where-visitors' },
            ],
        },
    },

    'kitchen-party-social': {
        7: {
            whatHappened: [
                'Kitchen Party Social is live tonight at the Battery Club.',
                'Walk-up ticket searches jumped this afternoon.',
                'Most visitors are on mobile, coming from Organic Social and direct.',
            ],
            headsUp: [
                { id: 'spike', title: 'Doors are open tonight', reason: 'Live now: walk-up visitors are still arriving.', to: '#where-visitors' },
            ],
        },
        28: {
            whatHappened: [
                'The kitchen party built steadily on the mailing list and Organic Social.',
                'Today is show day, and walk-up traffic is still coming in.',
                'Mobile visitors outnumber desktop almost two to one.',
            ],
            headsUp: [
                { id: 'spike', title: 'Show day traffic is up', reason: 'Kitchen Party Social is live at the Battery Club.', to: '#where-visitors' },
            ],
        },
        90: {
            whatHappened: [
                'This is a short-lead room: almost every visit and purchase is in the last month.',
                'Locals already know the address, so Direct stays strong.',
                'Email reminders still close the last seats.',
            ],
            headsUp: [
                { id: 'source', title: 'Direct and email lead the room', reason: 'Regulars and the list are carrying this night.', to: '#where-visitors' },
            ],
        },
    },
    all: {
        7: {
            whatHappened: [
                'Kitchen Party Social is live tonight and is pulling last-minute visits.',
                'Harbour Lights still accounts for most visitors across the month.',
                'Checkout is the common sticky step.',
            ],
            headsUp: [
                { id: 'drop', title: 'Aurora traffic dipped', reason: 'Aurora After Dark cooled after Tuesday.', to: '#where-visitors' },
            ],
        },
        28: {
            whatHappened: [
                'Harbour Lights Festival is carrying most of the visitors this month.',
                'Aurora After Dark jumped Tuesday on Organic Social.',
                'Paid Social is the fastest-growing door in across the site.',
            ],
            headsUp: [
                { id: 'spike', title: 'Traffic spiked on Tuesday', reason: 'Aurora After Dark jumped after the lineup post.', to: '#where-visitors' },
                { id: 'source', title: 'Paid Social is growing fast', reason: 'Paid Social is up on the festival pages.', to: '#where-visitors' },
                { id: 'checkout', title: 'Checkout drop-off is high', reason: 'Checkout loses people on Aurora and Fog City.', to: '#ticket-path' },
            ],
        },
        90: {
            whatHappened: [
                'The festival is the long story: visits built for months, then jumped with the lineup.',
                'Aurora After Dark had a shorter Organic Social burst in November.',
                'Fog City stayed a Direct-visit page the whole time.',
            ],
            headsUp: [
                { id: 'source', title: 'Paid Social is growing fast', reason: 'Festival Paid Social has led new visitors since October.', to: '#where-visitors' },
            ],
        },
    },
};


const auroraSpikeDay = () => weekdayLong(PAGE_PERIODS['aurora-after-dark'].spikeDate);
const replaceTuesday = (value) => {
    const day = auroraSpikeDay();
    if (typeof value === 'string') return value.replaceAll('Tuesday', day);
    if (Array.isArray(value)) return value.map(replaceTuesday);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, replaceTuesday(inner)]));
    }
    return value;
};
AI_COPY['aurora-after-dark'] = replaceTuesday(AI_COPY['aurora-after-dark']);
AI_COPY.all = replaceTuesday(AI_COPY.all);

export const spikeWeekdayName = (pageId) => weekdayLong((PAGE_PERIODS[pageId] || PAGE_PERIODS['aurora-after-dark']).spikeDate);

const inWindow = (iso, dates) => dates[0] <= iso && iso <= dates[dates.length - 1];

const rowsInWindow = (report, dates) => adaptGa4Report(report).filter((row) => inWindow(ga4DateToIso(row.dimensions.date), dates));

const mergeReports = (reports, dimensionNames, metricNames) => makeGa4Report(
    dimensionNames,
    metricNames,
    reports.flatMap((report) => adaptGa4Report(report).map((row) => ({ ...row.dimensions, ...row.metrics })))
);

const selectedPages = (pageId) => {
    if (pageId === 'all') return ANALYTICS_PAGES.filter((page) => page.id !== 'all' && !page.empty);
    return ANALYTICS_PAGES.filter((page) => page.id === pageId);
};

const copyFor = (pageId, range) => {
    const bucket = AI_COPY[pageId] || AI_COPY.all;
    return bucket[range] || bucket[28];
};

const dropOffPercent = (from, to) => {
    if (!from) return 0;
    return Math.round((1 - (to / from)) * 100);
};

const trendFromChange = (change) => {
    if (change == null || Math.abs(change) < 2) return 'flat';
    return change > 0 ? 'up' : 'down';
};

const forecastPoints = (dates, dailyVisitors, extraDays = 7) => {
    const values = dates.map((iso) => dailyVisitors[iso] || 0);
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

const pageChoices = () => ANALYTICS_PAGES.map((page) => ({
    id: page.id,
    name: page.id === 'all' ? 'All pages' : page.name,
    path: page.path,
}));

/**
 * @param {{ pageId?: string, range?: string }} [filters]
 */
export const selectAnalyticsDashboard = ({ pageId = DEFAULT_PAGE_ID, range = DEFAULT_RANGE } = {}) => {
    const rangeOption = DATE_RANGE_OPTIONS.find((option) => option.id === String(range)) || DATE_RANGE_OPTIONS[1];
    const days = rangeOption.days;
    const page = ANALYTICS_PAGES.find((item) => item.id === pageId) || ANALYTICS_PAGES[1];
    const lookingAtAll = page.id === 'all';
    const empty = Boolean(page.empty);

    if (empty) {
        return {
            empty: true,
            emptyMessage: EMPTY_STATE_MESSAGE,
            pageId: page.id,
            pageName: page.name,
            pagePath: page.path,
            range: rangeOption.id,
            rangeDays: days,
            pages: pageChoices(),
            liveNow: null,
            kpis: null,
            chart: null,
            pace: '',
            headsUp: [],
            whatHappened: [],
            channels: [],
            topPages: [],
            ticketPath: [],
            devices: [],
            cities: [],
        };
    }

    const pages = selectedPages(page.id);
    const sources = pages.map((item) => GA4_SOURCES[item.id]);
    const currentDates = dateWindow(MOCK_AS_OF, days);
    const current90 = dateWindow(MOCK_AS_OF, 90);
    const priorDates = dateWindow(addDays(current90[0], -1), days);

    const daily = mergeReports(sources.map((source) => source.daily), DAILY_DIMS, DAILY_METRICS);
    const channels = mergeReports(sources.map((source) => source.channels), CHANNEL_DIMS, CHANNEL_METRICS);
    const pageRows = mergeReports(sources.map((source) => source.pages), PAGE_DIMS, PAGE_METRICS);
    const events = mergeReports(sources.map((source) => source.events), EVENT_DIMS, EVENT_METRICS);
    const devices = mergeReports(sources.map((source) => source.devices), DEVICE_DIMS, DEVICE_METRICS);
    const cities = mergeReports(sources.map((source) => source.cities), CITY_DIMS, CITY_METRICS);
    const realtime = mergeReports(sources.map((source) => source.realtime), REALTIME_DIMS, REALTIME_METRICS);

    const currentDaily = rowsInWindow(daily, currentDates);
    const priorDaily = rowsInWindow(daily, priorDates);
    const currentVisitors = sumMetric(currentDaily, 'activeUsers');
    const priorVisitors = sumMetric(priorDaily, 'activeUsers');
    const currentViews = sumMetric(currentDaily, 'screenPageViews');
    const priorViews = sumMetric(priorDaily, 'screenPageViews');
    const currentPurchases = sumMetric(currentDaily, 'ecommercePurchases');
    const priorPurchases = sumMetric(priorDaily, 'ecommercePurchases');
    const currentDuration = weightedAverage(currentDaily, 'averageSessionDuration', 'activeUsers');
    const priorDuration = weightedAverage(priorDaily, 'averageSessionDuration', 'activeUsers');

    const visitorsByCurrentDate = {};
    const visitorsByPriorAligned = {};
    currentDates.forEach((iso, index) => {
        visitorsByCurrentDate[iso] = 0;
        visitorsByPriorAligned[iso] = 0;
        const priorIso = priorDates[index];
        currentDaily.forEach((row) => {
            if (ga4DateToIso(row.dimensions.date) === iso) visitorsByCurrentDate[iso] += row.metrics.activeUsers || 0;
        });
        priorDaily.forEach((row) => {
            if (ga4DateToIso(row.dimensions.date) === priorIso) visitorsByPriorAligned[iso] += row.metrics.activeUsers || 0;
        });
    });

    const livePeople = sumMetric(adaptGa4Report(realtime), 'activeUsers');
    const visitorChange = percentChange(currentVisitors, priorVisitors);
    const pace = visitorChange == null
        ? 'Visitor numbers are even with last period.'
        : visitorChange >= 0
            ? `Visitors are running ${Math.round(visitorChange)}% ahead of last period.`
            : `Visitors are running ${Math.round(Math.abs(visitorChange))}% behind last period.`;

    const copy = copyFor(lookingAtAll ? 'all' : page.id, rangeOption.id);
    const channelTips = lookingAtAll
        ? PAGE_PERIODS['harbour-lights-festival'].tips
        : (GA4_SOURCES[page.id]?.tips || {});

    const currentChannels = rowsInWindow(channels, currentDates);
    const channelCards = CHANNELS.map((channel) => {
        const rows = currentChannels.filter((row) => row.dimensions.sessionDefaultChannelGroup === channel.label);
        return {
            id: channel.id,
            label: channel.label,
            visitors: sumMetric(rows, 'activeUsers'),
            purchases: sumMetric(rows, 'ecommercePurchases'),
            tip: channelTips[channel.id] || '',
        };
    }).sort((left, right) => right.visitors - left.visitors || right.purchases - left.purchases);

    const currentPageRows = rowsInWindow(pageRows, currentDates);
    const priorPageRows = rowsInWindow(pageRows, priorDates);
    const pageMap = {};
    currentPageRows.forEach((row) => {
        const path = row.dimensions.pagePath;
        if (!pageMap[path]) pageMap[path] = { path, title: row.dimensions.pageTitle, current: 0, prior: 0 };
        pageMap[path].current += row.metrics.screenPageViews || 0;
        pageMap[path].title = row.dimensions.pageTitle || pageMap[path].title;
    });
    priorPageRows.forEach((row) => {
        const path = row.dimensions.pagePath;
        if (!pageMap[path]) pageMap[path] = { path, title: row.dimensions.pageTitle, current: 0, prior: 0 };
        pageMap[path].prior += row.metrics.screenPageViews || 0;
    });
    const topPages = Object.values(pageMap)
        .sort((left, right) => right.current - left.current)
        .slice(0, 6)
        .map((item) => ({
            ...item,
            trend: trendFromChange(percentChange(item.current, item.prior)),
        }));

    const currentEvents = rowsInWindow(events, currentDates);
    const pathSteps = FUNNEL_EVENTS.map((event, index, list) => {
        const count = sumMetric(currentEvents.filter((row) => row.dimensions.eventName === event.id), 'eventCount');
        const next = list[index + 1]
            ? sumMetric(currentEvents.filter((row) => row.dimensions.eventName === list[index + 1].id), 'eventCount')
            : null;
        const revenue = event.id === 'purchase'
            ? sumMetric(currentEvents.filter((row) => row.dimensions.eventName === 'purchase'), 'purchaseRevenue')
            : null;
        const drop = next == null ? 0 : dropOffPercent(count, next);
        return {
            id: event.id,
            label: event.label,
            count,
            dropOffPercent: drop,
            dropOff: next == null
                ? null
                : `${drop}% drop-off to ${list[index + 1].label}`,
            revenue,
        };
    });

    const currentDevices = rowsInWindow(devices, currentDates);
    const deviceTotal = sumMetric(currentDevices, 'activeUsers') || 1;
    const deviceCards = DEVICE_CATEGORIES.map((device) => {
        const visitors = sumMetric(currentDevices.filter((row) => row.dimensions.deviceCategory === device), 'activeUsers');
        return {
            id: device,
            label: device[0].toUpperCase() + device.slice(1),
            visitors,
            share: Math.round((visitors / deviceTotal) * 100),
        };
    });

    const currentCities = rowsInWindow(cities, currentDates);
    const cityMap = {};
    currentCities.forEach((row) => {
        const city = row.dimensions.city;
        cityMap[city] = (cityMap[city] || 0) + (row.metrics.activeUsers || 0);
    });
    const cityCards = Object.entries(cityMap)
        .map(([label, visitors]) => ({ id: label, label, visitors }))
        .sort((left, right) => right.visitors - left.visitors)
        .slice(0, 5);

    return {
        empty: false,
        emptyMessage: EMPTY_STATE_MESSAGE,
        pageId: page.id,
        pageName: lookingAtAll ? 'All pages' : page.name,
        pagePath: page.path,
        range: rangeOption.id,
        rangeDays: days,
        pages: pageChoices(),
        liveNow: livePeople
            ? { people: livePeople, label: `${livePeople} people on your site right now` }
            : null,
        kpis: {
            visitors: { current: currentVisitors, prior: priorVisitors },
            pageViews: { current: currentViews, prior: priorViews },
            avgTime: { current: currentDuration, prior: priorDuration },
            purchases: { current: currentPurchases, prior: priorPurchases },
        },
        chart: {
            current: currentDates.map((iso) => ({ x: iso, y: visitorsByCurrentDate[iso] || 0 })),
            previous: currentDates.map((iso) => ({ x: iso, y: visitorsByPriorAligned[iso] || 0 })),
            forecast: forecastPoints(currentDates, visitorsByCurrentDate),
        },
        pace,
        headsUp: copy.headsUp,
        whatHappened: copy.whatHappened.map((text, index) => ({
            id: `happened-${index}`,
            text,
            to: index === 2 ? '#ticket-path' : '#where-visitors',
        })),
        channels: channelCards,
        topPages,
        ticketPath: pathSteps,
        devices: deviceCards,
        cities: cityCards,
        reports: { daily, channels, pages: pageRows, events, devices, cities, realtime },
    };
};

export const listAnalyticsPages = () => pageChoices();
