import { parsePlatformFilter } from './platforms';

/**
 * Typed mock-data module for the Social Dashboard prototype.
 * All accounts, posts, comments and peers are fictional demo records.
 * Nothing here is loaded from a network, API, Prisma model or customer store.
 *
 * @typedef {'ok'|'unavailable'|'awaiting'|'partial'} DataState
 * @typedef {'organic'|'paid'|'combined'|'unknown'} Distribution
 * @typedef {'instagram'|'tiktok'|'youtube'|'facebook'|'linkedin'} Platform
 * @typedef {'reel'|'carousel'|'image'|'text'|'story'|'video'|'live'} Format
 * @typedef {'positive'|'neutral'|'negative'|'mixed'|'unclassified'} Sentiment
 * @typedef {'current28'|'prior28'} PeriodKey
 *
 * @typedef {Object} MetricCell
 * @property {number|null} value
 * @property {DataState} state
 * @property {string} [note]
 *
 * @typedef {Object} SocialAccount
 * @property {string} id
 * @property {string} name
 * @property {string} handle
 * @property {Platform} platform
 * @property {number} followersOpen
 * @property {number} followersClose
 * @property {number} followersGained
 * @property {number} followersLost
 * @property {DataState} reachState
 * @property {string} sourceLabel
 *
 * @typedef {Object} DailyPoint
 * @property {string} date
 * @property {number} impressions
 * @property {number} engagements
 * @property {number} clicks
 * @property {number} netFollowers
 * @property {number} postsPublished
 * @property {number} mentions
 *
 * @typedef {Object} PostComment
 * @property {string} id
 * @property {string} postId
 * @property {string} author
 * @property {string} text
 * @property {Sentiment} sentiment
 * @property {string} theme
 * @property {number} reactions
 * @property {boolean} isQuestion
 * @property {boolean} teamReplied
 * @property {string} createdAt
 *
 * @typedef {Object} SocialPost
 * @property {string} id
 * @property {string} accountId
 * @property {Platform} platform
 * @property {Format} format
 * @property {Distribution} distribution
 * @property {string} publishedAt
 * @property {string} caption
 * @property {string} thumbnailLabel
 * @property {string[]} themes
 * @property {string|null} campaign
 * @property {string} mockPermalink
 * @property {MetricCell} reach
 * @property {MetricCell} impressions
 * @property {MetricCell} views
 * @property {number} likes
 * @property {number} commentsCount
 * @property {number} shares
 * @property {MetricCell} saves
 * @property {MetricCell} clicks
 * @property {number} eligibleComments
 * @property {number} classifiedComments
 * @property {number} unclassifiedComments
 * @property {number} positiveComments
 * @property {number} neutralComments
 * @property {number} negativeComments
 * @property {number} mixedComments
 * @property {number|null} percentile
 * @property {number|null} cohortSize
 * @property {number|null} cohortMedianRate
 * @property {'24h'|'7d'|'building'} snapshotAge
 * @property {boolean} buildingBaseline
 * @property {{hour:number, impressions:number, engagements:number}[]} growthSincePublish
 * @property {{t:number, retained:number}[]|null} videoRetention
 * @property {PostComment[]} comments
 */

export const REPORT_TIMEZONE = 'America/St_Johns';
export const LAST_REFRESH_AT = '2026-11-11T08:14:22-03:30';
export const MOCK_BRAND = 'Northlight Live (demo)';
export const SCOPE_LABEL = 'Owned accounts · mock snapshot · not live data';

export const CURRENT_RANGE = {
    start: '2026-10-14',
    end: '2026-11-10',
    label: 'Last 28 complete days',
};

export const PRIOR_RANGE = {
    start: '2026-09-16',
    end: '2026-10-13',
    label: 'Previous 28 days',
};

/** @type {{id:string, name:string, definition:string}[]} */
export const METRIC_DEFINITIONS = [
    { id: 'impressions', name: 'Impressions', definition: 'Number of displays in the provider’s scope. Count repeated displays where included by the source.' },
    { id: 'reach', name: 'Reach or unique viewers', definition: 'Provider-reported unique audience estimate for the account, post, or time window identified. Display channel-level totals unless a source provides deduplication across the selected population.' },
    { id: 'views', name: 'Views and engaged views', definition: 'Preserve native view definitions, including any playback threshold and replay rules. Keep view starts and qualified views as separate series.' },
    { id: 'engagements', name: 'Engagements', definition: 'Use a disclosed action set, such as likes or reactions, comments, shares, and saves. Expose the individual counts and the action types that were available.' },
    { id: 'engagementRate', name: 'Engagement rate', definition: 'Eligible interactions ÷ reach, impressions, or views × 100, with the denominator in the title. For public follower-based benchmarks, explicitly label the follower denominator. Use the same definition throughout each comparison.' },
    { id: 'followerGrowth', name: 'Follower growth', definition: 'Net followers = closing follower count − opening count. Growth rate = net followers ÷ opening count × 100 when opening count is positive. Show reported gains and losses separately when supplied.' },
    { id: 'outboundCtr', name: 'Outbound CTR', definition: 'Outbound clicks ÷ eligible impressions × 100 in the same scope. Bio-link CTR and ad outbound CTR belong to their own reporting surfaces.' },
    { id: 'positiveSentiment', name: 'Positive sentiment share', definition: 'Positive comments ÷ classified comments × 100. Classified includes positive, neutral, negative, and mixed. Show coverage as classified ÷ eligible.' },
    { id: 'responseRate', name: 'Response rate', definition: 'Eligible conversations that received a team reply ÷ eligible conversations started in the chosen period. Display the response observation cutoff. Track open conversations and their age alongside the rate.' },
    { id: 'shareOfVoice', name: 'Share of voice', definition: 'Brand-matched mentions ÷ all brand-matched mentions in a fixed peer set and listening query × 100. State how mentions of multiple brands are counted.' },
    { id: 'paidEfficiency', name: 'Paid efficiency', definition: 'Outbound CPC = spend ÷ outbound clicks. CPM = spend ÷ paid impressions × 1,000. Frequency uses the provider’s impression and paid-reach scope.' },
];

/** @type {SocialAccount[]} */
export const ACCOUNTS = [
    { id: 'ig-northlight', name: 'Northlight Live', handle: '@northlight.live.demo', platform: 'instagram', followersOpen: 46380, followersClose: 48210, followersGained: 2140, followersLost: 310, reachState: 'ok', sourceLabel: 'Instagram account insights (mock)' },
    { id: 'tt-northlight', name: 'Northlight Live', handle: '@northlightlive.demo', platform: 'tiktok', followersOpen: 88620, followersClose: 91400, followersGained: 3210, followersLost: 430, reachState: 'ok', sourceLabel: 'TikTok account analytics (mock)' },
    { id: 'yt-northlight', name: 'Northlight Live Demo', handle: 'youtube.com/@northlightlivedemo', platform: 'youtube', followersOpen: 12440, followersClose: 12880, followersGained: 510, followersLost: 70, reachState: 'ok', sourceLabel: 'YouTube Studio (mock)' },
    { id: 'fb-northlight', name: 'Northlight Live Demo', handle: 'facebook.com/northlightlivedemo', platform: 'facebook', followersOpen: 5980, followersClose: 6140, followersGained: 210, followersLost: 50, reachState: 'partial', sourceLabel: 'Facebook Page insights (mock, stories partial)' },
    { id: 'li-northlight', name: 'Northlight Live Demo', handle: 'linkedin.com/company/northlight-live-demo', platform: 'linkedin', followersOpen: 2180, followersClose: 2240, followersGained: 72, followersLost: 12, reachState: 'unavailable', sourceLabel: 'LinkedIn Page analytics (mock, reach unavailable)' },
];

const dateRange = (start, end) => {
    const out = [];
    const cursor = new Date(`${start}T12:00:00Z`);
    const last = new Date(`${end}T12:00:00Z`);
    while (cursor <= last) {
        out.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
};

const mulberry32 = (seed) => () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const addDaysIso = (iso, days) => {
    const cursor = new Date(`${iso}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + days);
    return cursor.toISOString().slice(0, 10);
};

export const RANGE_END = '2026-11-10';
export const DATE_RANGE_OPTIONS = [
    { id: '7', days: 7, label: 'Last 7 days', short: '7d' },
    { id: '28', days: 28, label: 'Last 28 days', short: '28d' },
    { id: '90', days: 90, label: 'Last 90 days', short: '90d' },
];

const FULL_DATES = dateRange(addDaysIso(RANGE_END, -179), RANGE_END);
const CURRENT_DATES = dateRange(CURRENT_RANGE.start, CURRENT_RANGE.end);
const PRIOR_DATES = dateRange(PRIOR_RANGE.start, PRIOR_RANGE.end);

const ACCOUNT_SERIES_SEEDS = {
    'ig-northlight': { seed: 11, impressions: 22000, engagements: 980, clicks: 140, net: 62, mentions: 18 },
    'tt-northlight': { seed: 23, impressions: 31000, engagements: 1500, clicks: 90, net: 92, mentions: 22 },
    'yt-northlight': { seed: 37, impressions: 6400, engagements: 410, clicks: 70, net: 14, mentions: 6 },
    'fb-northlight': { seed: 41, impressions: 2800, engagements: 160, clicks: 24, net: 5, mentions: 4 },
    'li-northlight': { seed: 53, impressions: 900, engagements: 48, clicks: 11, net: 2, mentions: 2 },
};

const buildSeries = (dates, spec, bumpDay) => {
    const rand = mulberry32(spec.seed);
    return dates.map((date, index) => {
        const wave = 0.82 + Math.sin(index / 4) * 0.18;
        const spike = date === bumpDay ? 1.85 : 1;
        const noise = 0.78 + rand() * 0.44;
        const postsPublished = [2, 8, 14, 20].includes(index) ? 1 : (index === 11 ? 2 : 0);
        return {
            date,
            impressions: Math.round(spec.impressions * wave * spike * noise),
            engagements: Math.round(spec.engagements * wave * spike * noise),
            clicks: Math.round(spec.clicks * wave * noise),
            netFollowers: Math.round(spec.net * (0.6 + rand()) * (spike > 1 ? 1.4 : 1) - spec.net * 0.15),
            postsPublished,
            mentions: Math.round(spec.mentions * wave * spike * (0.7 + rand() * 0.6)),
        };
    });
};

/** @type {Record<string, {full: DailyPoint[], current: DailyPoint[], prior: DailyPoint[]}>} */
export const ACCOUNT_SERIES = Object.fromEntries(
    ACCOUNTS.map((account) => {
        const full = buildSeries(FULL_DATES, ACCOUNT_SERIES_SEEDS[account.id], '2026-10-28');
        return [account.id, {
            full,
            current: full.slice(-28),
            prior: full.slice(-56, -28),
        }];
    }),
);

const cell = (value, state = 'ok', note) => ({ value, state, note });

const growthCurve = (start, peak, points = 14) => Array.from({ length: points }, (_, hour) => {
    const t = hour / Math.max(points - 1, 1);
    const impressions = Math.round(start + (peak - start) * (1 - Math.exp(-3 * t)));
    return { hour: hour * (hour < 8 ? 1 : 6), impressions, engagements: Math.round(impressions * 0.044) };
});

const retentionCurve = (dropAt = 8) => Array.from({ length: 21 }, (_, i) => {
    const t = i * 5;
    let retained = 100 - i * 2.4;
    if (t >= dropAt) retained -= (t - dropAt) * 0.9;
    return { t, retained: Math.max(18, Math.round(retained)) };
});

/** @type {PostComment[]} */
const AURORA_COMMENTS = [
    { id: 'c1', postId: 'ig-reel-aurora', author: 'Mira Chen (demo)', text: 'The teal and violet lighting on that stage drop is unreal. Need this for Harbour Lights.', sentiment: 'positive', theme: 'Praise for colour options', reactions: 42, isQuestion: false, teamReplied: false, createdAt: '2026-10-28T19:12:00-03:30' },
    { id: 'c2', postId: 'ig-reel-aurora', author: 'Owen Blake (demo)', text: 'Lineup is stacked. Already grabbed two GA. Northlight always delivers.', sentiment: 'positive', theme: 'Praise for lineup', reactions: 31, isQuestion: false, teamReplied: false, createdAt: '2026-10-28T19:18:00-03:30' },
    { id: 'c3', postId: 'ig-reel-aurora', author: 'Sable Ortiz (demo)', text: 'Do you restock the night-shift tees? Sizing chart still 404s on the mock shop.', sentiment: 'negative', theme: 'Complaints about limited stock', reactions: 19, isQuestion: true, teamReplied: true, createdAt: '2026-10-28T19:41:00-03:30' },
    { id: 'c4', postId: 'ig-reel-aurora', author: 'Jonah Hale (demo)', text: 'What sizes are left for the reflective jacket? XL gone in 20 minutes last drop.', sentiment: 'neutral', theme: 'Questions about sizing', reactions: 14, isQuestion: true, teamReplied: true, createdAt: '2026-10-28T20:02:00-03:30' },
    { id: 'c5', postId: 'ig-reel-aurora', author: 'Priya Nair (demo)', text: 'Love the reel, but merch sold out before I could check out. Please stagger drops.', sentiment: 'mixed', theme: 'Complaints about limited stock', reactions: 22, isQuestion: false, teamReplied: true, createdAt: '2026-10-28T20:15:00-03:30' },
    { id: 'c6', postId: 'ig-reel-aurora', author: 'Eli Park (demo)', text: 'Are GA tickets still transferable between the Friday and Saturday rooms?', sentiment: 'neutral', theme: 'Questions about tickets', reactions: 9, isQuestion: true, teamReplied: false, createdAt: '2026-10-28T21:04:00-03:30' },
    { id: 'c7', postId: 'ig-reel-aurora', author: 'Noa Ellison (demo)', text: 'Colour grade on the fog look is chef’s kiss. Best Northlight reel this year.', sentiment: 'positive', theme: 'Praise for colour options', reactions: 27, isQuestion: false, teamReplied: false, createdAt: '2026-10-29T09:22:00-03:30' },
    { id: 'c8', postId: 'ig-reel-aurora', author: 'Chris Vale (demo)', text: 'Audio clipped hard at 0:12. The drop deserved a cleaner mix.', sentiment: 'negative', theme: 'Complaints about audio', reactions: 11, isQuestion: false, teamReplied: false, createdAt: '2026-10-29T11:40:00-03:30' },
    { id: 'c9', postId: 'ig-reel-aurora', author: 'Harper Quinn (demo)', text: 'Is there an accessible viewing platform for Aurora After Dark?', sentiment: 'neutral', theme: 'Questions about accessibility', reactions: 16, isQuestion: true, teamReplied: true, createdAt: '2026-10-29T14:08:00-03:30' },
    { id: 'c10', postId: 'ig-reel-aurora', author: 'Demo User 11', text: '🔥🔥🔥', sentiment: 'unclassified', theme: 'Unclassified', reactions: 4, isQuestion: false, teamReplied: false, createdAt: '2026-10-29T16:01:00-03:30' },
    { id: 'c11', postId: 'ig-reel-aurora', author: 'Léa Moreau (demo)', text: 'Trop beau le violet, vous sortez les vestes quand?', sentiment: 'unclassified', theme: 'Unclassified', reactions: 3, isQuestion: true, teamReplied: false, createdAt: '2026-10-29T18:44:00-03:30' },
    { id: 'c12', postId: 'ig-reel-aurora', author: 'Theo Ames (demo)', text: 'Doors at 8 or 9? Last year the set started late and we missed the opener.', sentiment: 'neutral', theme: 'Questions about doors', reactions: 8, isQuestion: true, teamReplied: false, createdAt: '2026-10-30T08:17:00-03:30' },
];

const commentsFor = (postId, rows) => rows.map((row, index) => ({
    id: `${postId}-c${index + 1}`,
    postId,
    createdAt: `2026-10-${20 + (index % 8)}T18:${String(10 + index).padStart(2, '0')}:00-03:30`,
    reactions: 3 + index,
    teamReplied: index % 3 === 0,
    ...row,
}));

/** @type {SocialPost[]} */
export const POSTS = [
    {
        id: 'ig-reel-aurora',
        accountId: 'ig-northlight',
        platform: 'instagram',
        format: 'reel',
        distribution: 'organic',
        publishedAt: '2026-10-28T18:05:00-03:30',
        caption: 'Aurora After Dark — lineup drop. Fog, violet, and the first 400 jackets.',
        thumbnailLabel: 'Aurora After Dark Reel',
        themes: ['lineup', 'merch', 'aurora-after-dark'],
        campaign: 'Aurora After Dark',
        mockPermalink: 'https://instagram.example/p/demo-aurora-after-dark',
        reach: cell(168400),
        impressions: cell(184900),
        views: cell(176200),
        likes: 900,
        commentsCount: 140,
        shares: 120,
        saves: cell(80),
        clicks: cell(210),
        eligibleComments: 125,
        classifiedComments: 121,
        unclassifiedComments: 4,
        positiveComments: 72,
        neutralComments: 27,
        negativeComments: 18,
        mixedComments: 4,
        percentile: 94,
        cohortSize: 28,
        cohortMedianRate: 2.9,
        snapshotAge: '24h',
        buildingBaseline: false,
        growthSincePublish: growthCurve(14200, 168400),
        videoRetention: retentionCurve(12),
        comments: AURORA_COMMENTS,
    },
    {
        id: 'ig-carousel-fog',
        accountId: 'ig-northlight',
        platform: 'instagram',
        format: 'carousel',
        distribution: 'organic',
        publishedAt: '2026-10-22T16:40:00-03:30',
        caption: 'Fog City Sessions — five rooms, one weekend pass.',
        thumbnailLabel: 'Fog City carousel',
        themes: ['fog-city', 'tickets'],
        campaign: 'Fog City Sessions',
        mockPermalink: 'https://instagram.example/p/demo-fog-city',
        reach: cell(18420),
        impressions: cell(22110),
        views: cell(null, 'unavailable', 'Carousel views are not supplied for this mock account.'),
        likes: 640,
        commentsCount: 48,
        shares: 70,
        saves: cell(110),
        clicks: cell(320),
        eligibleComments: 44,
        classifiedComments: 41,
        unclassifiedComments: 3,
        positiveComments: 29,
        neutralComments: 8,
        negativeComments: 3,
        mixedComments: 1,
        percentile: 64,
        cohortSize: 22,
        cohortMedianRate: 3.1,
        snapshotAge: '7d',
        buildingBaseline: false,
        growthSincePublish: growthCurve(1800, 18420),
        videoRetention: null,
        comments: commentsFor('ig-carousel-fog', [
            { author: 'Dana Ruiz (demo)', text: 'Weekend pass is the move. Rooms 3 and 5 were the highlight last year.', sentiment: 'positive', theme: 'Praise for rooms', isQuestion: false },
            { author: 'Kit Morrow (demo)', text: 'Can I split the pass across two people?', sentiment: 'neutral', theme: 'Questions about tickets', isQuestion: true },
        ]),
    },
    {
        id: 'ig-reel-below',
        accountId: 'ig-northlight',
        platform: 'instagram',
        format: 'reel',
        distribution: 'organic',
        publishedAt: '2026-10-18T12:10:00-03:30',
        caption: 'Quick recap from last Thursday’s soundcheck.',
        thumbnailLabel: 'Soundcheck recap',
        themes: ['behind-the-scenes'],
        campaign: null,
        mockPermalink: 'https://instagram.example/p/demo-soundcheck',
        reach: cell(6200),
        impressions: cell(7100),
        views: cell(6900),
        likes: 140,
        commentsCount: 12,
        shares: 8,
        saves: cell(9),
        clicks: cell(18),
        eligibleComments: 12,
        classifiedComments: 11,
        unclassifiedComments: 1,
        positiveComments: 6,
        neutralComments: 4,
        negativeComments: 1,
        mixedComments: 0,
        percentile: 18,
        cohortSize: 28,
        cohortMedianRate: 2.9,
        snapshotAge: '7d',
        buildingBaseline: false,
        growthSincePublish: growthCurve(900, 6200),
        videoRetention: retentionCurve(6),
        comments: commentsFor('ig-reel-below', [
            { author: 'Sam Irons (demo)', text: 'Missed the hook. Still going though.', sentiment: 'neutral', theme: 'Creative notes', isQuestion: false },
        ]),
    },
    {
        id: 'ig-reel-building',
        accountId: 'ig-northlight',
        platform: 'instagram',
        format: 'reel',
        distribution: 'organic',
        publishedAt: '2026-11-10T22:40:00-03:30',
        caption: 'Doors tomorrow. Bring the reflective jacket if you copped one.',
        thumbnailLabel: 'Doors tomorrow',
        themes: ['aurora-after-dark'],
        campaign: 'Aurora After Dark',
        mockPermalink: 'https://instagram.example/p/demo-doors-tomorrow',
        reach: cell(1840),
        impressions: cell(2100),
        views: cell(1980),
        likes: 96,
        commentsCount: 7,
        shares: 11,
        saves: cell(6),
        clicks: cell(14),
        eligibleComments: 7,
        classifiedComments: 6,
        unclassifiedComments: 1,
        positiveComments: 4,
        neutralComments: 2,
        negativeComments: 0,
        mixedComments: 0,
        percentile: null,
        cohortSize: 8,
        cohortMedianRate: null,
        snapshotAge: 'building',
        buildingBaseline: true,
        growthSincePublish: growthCurve(220, 1840, 8),
        videoRetention: retentionCurve(20),
        comments: commentsFor('ig-reel-building', [
            { author: 'Riley Frost (demo)', text: 'See you in the front rail.', sentiment: 'positive', theme: 'Praise for lineup', isQuestion: false },
        ]),
    },
    {
        id: 'ig-promoted-earlybird',
        accountId: 'ig-northlight',
        platform: 'instagram',
        format: 'image',
        distribution: 'paid',
        publishedAt: '2026-10-16T11:00:00-03:30',
        caption: 'Early-bird GA for Harbour Lights Festival. Demo ad creative.',
        thumbnailLabel: 'Early-bird GA ad',
        themes: ['tickets', 'harbour-lights'],
        campaign: 'Harbour Lights Festival',
        mockPermalink: 'https://instagram.example/p/demo-earlybird',
        reach: cell(41200),
        impressions: cell(88040),
        views: cell(null, 'unavailable'),
        likes: 420,
        commentsCount: 36,
        shares: 44,
        saves: cell(28),
        clicks: cell(1860),
        eligibleComments: 34,
        classifiedComments: 32,
        unclassifiedComments: 2,
        positiveComments: 18,
        neutralComments: 9,
        negativeComments: 4,
        mixedComments: 1,
        percentile: 71,
        cohortSize: 16,
        cohortMedianRate: 1.4,
        snapshotAge: '7d',
        buildingBaseline: false,
        growthSincePublish: growthCurve(4200, 41200),
        videoRetention: null,
        comments: commentsFor('ig-promoted-earlybird', [
            { author: 'Eden Walsh (demo)', text: 'Is the early-bird refundable if the room changes?', sentiment: 'neutral', theme: 'Questions about tickets', isQuestion: true },
            { author: 'Matt Cole (demo)', text: 'Ad followed me for a week. Still bought it.', sentiment: 'mixed', theme: 'Paid delivery', isQuestion: false },
        ]),
    },
    {
        id: 'ig-sparse',
        accountId: 'ig-northlight',
        platform: 'instagram',
        format: 'image',
        distribution: 'organic',
        publishedAt: '2026-10-25T09:30:00-03:30',
        caption: 'Poster study for Fog City. Static still.',
        thumbnailLabel: 'Poster study',
        themes: ['creative'],
        campaign: 'Fog City Sessions',
        mockPermalink: 'https://instagram.example/p/demo-poster',
        reach: cell(4100),
        impressions: cell(4680),
        views: cell(null, 'unavailable'),
        likes: 180,
        commentsCount: 3,
        shares: 6,
        saves: cell(22),
        clicks: cell(9),
        eligibleComments: 3,
        classifiedComments: 3,
        unclassifiedComments: 0,
        positiveComments: 2,
        neutralComments: 1,
        negativeComments: 0,
        mixedComments: 0,
        percentile: 41,
        cohortSize: 24,
        cohortMedianRate: 3.4,
        snapshotAge: '7d',
        buildingBaseline: false,
        growthSincePublish: growthCurve(700, 4100),
        videoRetention: null,
        comments: commentsFor('ig-sparse', [
            { author: 'Jules Adeyemi (demo)', text: 'Print this.', sentiment: 'positive', theme: 'Praise for colour options', isQuestion: false },
        ]),
    },
    {
        id: 'tt-fog-drop',
        accountId: 'tt-northlight',
        platform: 'tiktok',
        format: 'video',
        distribution: 'organic',
        publishedAt: '2026-10-28T19:30:00-03:30',
        caption: 'POV: the Fog City strobe hits and the floor disappears.',
        thumbnailLabel: 'Fog City strobe',
        themes: ['fog-city', 'lineup'],
        campaign: 'Fog City Sessions',
        mockPermalink: 'https://tiktok.example/@northlightlive.demo/video/demo-fog',
        reach: cell(126400),
        impressions: cell(142200),
        views: cell(139800),
        likes: 8400,
        commentsCount: 310,
        shares: 2200,
        saves: cell(null, 'partial', 'Saves are partial for this TikTok mock window.'),
        clicks: cell(180),
        eligibleComments: 280,
        classifiedComments: 252,
        unclassifiedComments: 28,
        positiveComments: 160,
        neutralComments: 54,
        negativeComments: 22,
        mixedComments: 16,
        percentile: 91,
        cohortSize: 40,
        cohortMedianRate: 4.8,
        snapshotAge: '7d',
        buildingBaseline: false,
        growthSincePublish: growthCurve(8200, 126400),
        videoRetention: retentionCurve(9),
        comments: commentsFor('tt-fog-drop', [
            { author: 'Ivy Brooks (demo)', text: 'Who was on the decks at 1:12? Need that name on the lineup graphic.', sentiment: 'positive', theme: 'Questions about lineup', isQuestion: true },
            { author: 'Cole Nguyen (demo)', text: 'This is the one. Harbour Lights better look like this.', sentiment: 'positive', theme: 'Praise for energy', isQuestion: false },
            { author: 'Dana Ruiz (demo)', text: 'Caption says Fog City but the clip looks like Aurora. Which night?', sentiment: 'negative', theme: 'Complaints about labelling', isQuestion: true },
        ]),
    },
    {
        id: 'tt-questions',
        accountId: 'tt-northlight',
        platform: 'tiktok',
        format: 'video',
        distribution: 'organic',
        publishedAt: '2026-11-02T15:20:00-03:30',
        caption: 'How to get from Harbour Station to the warehouse. 40 seconds.',
        thumbnailLabel: 'Transit guide',
        themes: ['logistics'],
        campaign: 'Harbour Lights Festival',
        mockPermalink: 'https://tiktok.example/@northlightlive.demo/video/demo-transit',
        reach: cell(48200),
        impressions: cell(52100),
        views: cell(51040),
        likes: 1900,
        commentsCount: 220,
        shares: 640,
        saves: cell(410),
        clicks: cell(90),
        eligibleComments: 210,
        classifiedComments: 198,
        unclassifiedComments: 12,
        positiveComments: 70,
        neutralComments: 96,
        negativeComments: 18,
        mixedComments: 14,
        percentile: 77,
        cohortSize: 40,
        cohortMedianRate: 4.8,
        snapshotAge: '7d',
        buildingBaseline: false,
        growthSincePublish: growthCurve(4000, 48200),
        videoRetention: retentionCurve(18),
        comments: commentsFor('tt-questions', [
            { author: 'Noah Patel (demo)', text: 'Does the shuttle run after 1am?', sentiment: 'neutral', theme: 'Questions about transit', isQuestion: true },
            { author: 'Asha Gervais (demo)', text: 'Is there bike parking or do we lock up on the fence again?', sentiment: 'neutral', theme: 'Questions about transit', isQuestion: true },
            { author: 'Ben Idris (demo)', text: 'Walked it last year in the rain. Please add a covered stop.', sentiment: 'negative', theme: 'Complaints about transit', isQuestion: false },
        ]),
    },
    {
        id: 'yt-behind-scenes',
        accountId: 'yt-northlight',
        platform: 'youtube',
        format: 'video',
        distribution: 'organic',
        publishedAt: '2026-10-20T12:00:00-03:30',
        caption: 'Building the Aurora room: truss, fog, and the 40-minute delay.',
        thumbnailLabel: 'Aurora room build',
        themes: ['behind-the-scenes', 'aurora-after-dark'],
        campaign: 'Aurora After Dark',
        mockPermalink: 'https://youtube.example/watch?v=demoAuroraRoom',
        reach: cell(9600),
        impressions: cell(18400),
        views: cell(12110),
        likes: 410,
        commentsCount: 54,
        shares: 38,
        saves: cell(null, 'unavailable', 'YouTube does not expose saves in this mock.'),
        clicks: cell(260),
        eligibleComments: 54,
        classifiedComments: 50,
        unclassifiedComments: 4,
        positiveComments: 31,
        neutralComments: 12,
        negativeComments: 5,
        mixedComments: 2,
        percentile: 68,
        cohortSize: 12,
        cohortMedianRate: 3.6,
        snapshotAge: '7d',
        buildingBaseline: false,
        growthSincePublish: growthCurve(800, 12110),
        videoRetention: retentionCurve(22),
        comments: commentsFor('yt-behind-scenes', [
            { author: 'Cam Rhodes (demo)', text: 'Timestamp 7:14 is the money shot. More of this, less talking head.', sentiment: 'positive', theme: 'Praise for craft', isQuestion: false },
            { author: 'Lina Cho (demo)', text: 'Why no captions on the interview segment?', sentiment: 'negative', theme: 'Questions about accessibility', isQuestion: true },
        ]),
    },
    {
        id: 'fb-older-traffic',
        accountId: 'fb-northlight',
        platform: 'facebook',
        format: 'text',
        distribution: 'organic',
        publishedAt: '2026-09-30T10:15:00-03:30',
        caption: 'Reminder: last year’s Harbour Lights recap album is still up. Older post still getting clicks this period.',
        thumbnailLabel: 'Recap album',
        themes: ['harbour-lights'],
        campaign: 'Harbour Lights Festival',
        mockPermalink: 'https://facebook.example/northlightlivedemo/posts/demo-recap',
        reach: cell(2400, 'partial', 'Story + feed mix is only partially available.'),
        impressions: cell(3900, 'partial'),
        views: cell(null, 'unavailable'),
        likes: 96,
        commentsCount: 18,
        shares: 21,
        saves: cell(null, 'unavailable'),
        clicks: cell(410),
        eligibleComments: 18,
        classifiedComments: 16,
        unclassifiedComments: 2,
        positiveComments: 9,
        neutralComments: 5,
        negativeComments: 2,
        mixedComments: 0,
        percentile: 55,
        cohortSize: 20,
        cohortMedianRate: 2.1,
        snapshotAge: '7d',
        buildingBaseline: false,
        growthSincePublish: growthCurve(400, 2400),
        videoRetention: null,
        comments: commentsFor('fb-older-traffic', [
            { author: 'Pat Singh (demo)', text: 'Still the best recap album you posted.', sentiment: 'positive', theme: 'Praise for recap', isQuestion: false },
        ]),
    },
    {
        id: 'li-unavailable',
        accountId: 'li-northlight',
        platform: 'linkedin',
        format: 'text',
        distribution: 'unknown',
        publishedAt: '2026-10-24T08:00:00-03:30',
        caption: 'Hiring two door leads for Harbour Lights. Demo post — reach not supplied.',
        thumbnailLabel: 'Door leads hiring',
        themes: ['hiring'],
        campaign: null,
        mockPermalink: 'https://linkedin.example/feed/update/demo-hiring',
        reach: cell(null, 'unavailable', 'LinkedIn unique viewers are not in this mock extract.'),
        impressions: cell(1840),
        views: cell(null, 'unavailable'),
        likes: 54,
        commentsCount: 11,
        shares: 9,
        saves: cell(null, 'unavailable'),
        clicks: cell(72),
        eligibleComments: 11,
        classifiedComments: 10,
        unclassifiedComments: 1,
        positiveComments: 6,
        neutralComments: 3,
        negativeComments: 1,
        mixedComments: 0,
        percentile: null,
        cohortSize: 6,
        cohortMedianRate: null,
        snapshotAge: '7d',
        buildingBaseline: true,
        growthSincePublish: growthCurve(120, 1840),
        videoRetention: null,
        comments: commentsFor('li-unavailable', [
            { author: 'Morgan Ellis (demo)', text: 'Are these paid door leads or volunteer?', sentiment: 'neutral', theme: 'Questions about hiring', isQuestion: true },
        ]),
    },
    {
        id: 'ig-story-partial',
        accountId: 'ig-northlight',
        platform: 'instagram',
        format: 'story',
        distribution: 'organic',
        publishedAt: '2026-11-04T20:00:00-03:30',
        caption: 'Story frame: merch table at midnight.',
        thumbnailLabel: 'Merch table story',
        themes: ['merch'],
        campaign: 'Aurora After Dark',
        mockPermalink: 'https://instagram.example/stories/demo-merch',
        reach: cell(9200, 'partial', 'Story reach is a 24-hour snapshot only.'),
        impressions: cell(11040, 'partial'),
        views: cell(10110, 'partial'),
        likes: 0,
        commentsCount: 0,
        shares: 40,
        saves: cell(null, 'unavailable'),
        clicks: cell(88),
        eligibleComments: 0,
        classifiedComments: 0,
        unclassifiedComments: 0,
        positiveComments: 0,
        neutralComments: 0,
        negativeComments: 0,
        mixedComments: 0,
        percentile: 48,
        cohortSize: 30,
        cohortMedianRate: 0,
        snapshotAge: '24h',
        buildingBaseline: false,
        growthSincePublish: growthCurve(1100, 9200, 6),
        videoRetention: null,
        comments: [],
    },
];

export const LISTENING_QUERY = {
    name: 'Northlight brand conversation',
    terms: ['"Northlight Live"', '"Aurora After Dark"', '"Fog City Sessions"', '"Harbour Lights Festival"'],
    sources: ['Public Instagram', 'TikTok', 'X (mock firehose)', 'Blogs / news'],
    coverageNote: 'Mock peer set. Mentions of multiple brands are counted once per brand.',
};

export const LISTENING_SPIKE_DATE = '2026-10-28';

export const LISTENING_TOPICS = [
    { id: 'lineup', label: 'Lineup / artists', mentions: 420, sentiment: 0.62 },
    { id: 'merch', label: 'Merch stock', mentions: 180, sentiment: -0.18 },
    { id: 'tickets', label: 'Tickets / GA', mentions: 260, sentiment: 0.21 },
    { id: 'transit', label: 'Transit / doors', mentions: 140, sentiment: 0.05 },
    { id: 'sound', label: 'Sound / production', mentions: 90, sentiment: 0.34 },
];

export const LISTENING_MENTIONS = [
    { id: 'm1', date: '2026-10-28', source: 'TikTok', author: 'clipbot.demo', text: 'Northlight just dropped Aurora After Dark and the comments are feral.', sentiment: 'positive', topic: 'lineup' },
    { id: 'm2', date: '2026-10-28', source: 'Instagram', author: 'jacketwatch.demo', text: 'Jacket sold out in 12 minutes. Classic Northlight merch drop.', sentiment: 'negative', topic: 'merch' },
    { id: 'm3', date: '2026-10-28', source: 'X', author: 'harbour.radar.demo', text: 'Fog City clip is circulating with the wrong night labelled.', sentiment: 'negative', topic: 'lineup' },
    { id: 'm4', date: '2026-10-29', source: 'Blog', author: 'eastport-weekly.demo', text: 'Northlight’s Aurora reel is the week’s most-shared local clip.', sentiment: 'positive', topic: 'lineup' },
    { id: 'm5', date: '2026-11-02', source: 'TikTok', author: 'bus-map.demo', text: 'That Harbour Station walkthrough is doing numbers. Shuttle questions everywhere.', sentiment: 'neutral', topic: 'transit' },
];

export const COMPETITORS = [
    { id: 'peer-foghorn', name: 'Foghorn Promotions (demo)', platform: 'instagram', followers: 61200, posts: 24, publicInteractionsPerPost: 980, formatMix: 'Reels-heavy', topPost: 'Warehouse teaser', comparable: true },
    { id: 'peer-eastport', name: 'Eastport Shows (demo)', platform: 'instagram', followers: 44800, posts: 18, publicInteractionsPerPost: 640, formatMix: 'Carousel + Reels', topPost: 'Guest list myth', comparable: true },
    { id: 'peer-atlantic', name: 'Atlantic Room (demo)', platform: 'tiktok', followers: 120400, posts: 31, publicInteractionsPerPost: 2400, formatMix: 'Short video', topPost: 'Door policy skit', comparable: true },
    { id: 'peer-signal', name: 'Signal Club (demo)', platform: 'instagram', followers: 9100, posts: 12, publicInteractionsPerPost: null, formatMix: 'Unknown', topPost: 'Awaiting public posts', comparable: false, state: 'awaiting' },
];

export const SHARE_OF_VOICE = [
    { brand: 'Northlight Live (demo)', mentions: 1280, share: 38 },
    { brand: 'Foghorn Promotions (demo)', mentions: 940, share: 28 },
    { brand: 'Eastport Shows (demo)', mentions: 620, share: 18 },
    { brand: 'Atlantic Room (demo)', mentions: 540, share: 16 },
];

export const PAID_ORGANIC = {
    currency: 'CAD',
    attributionWindow: '7-day click / 1-day view (mock ad account)',
    organic: { impressions: 1240800, engagements: 74210, clicks: 7780, spend: 0 },
    paid: { impressions: 601800, engagements: 12210, clicks: 1860, spend: 4280, reach: 214000, frequency: 2.81 },
    campaigns: [
        { id: 'ads-earlybird', name: 'Early-bird GA', platform: 'instagram', spend: 2680, impressions: 88040, clicks: 1860, ctr: 2.11, cpc: 1.44, cpm: 30.44, result: 'Outbound click' },
        { id: 'ads-reminder', name: 'Lineup reminder', platform: 'facebook', spend: 1600, impressions: 51200, clicks: 420, ctr: 0.82, cpc: 3.81, cpm: 31.25, result: 'Outbound click' },
    ],
};

export const AUDIENCE = {
    populationLabel: 'Followers (Instagram @northlight.live.demo)',
    countries: [
        { id: 'CA', label: 'Canada', value: 72 },
        { id: 'US', label: 'United States', value: 18 },
        { id: 'GB', label: 'United Kingdom', value: 5 },
        { id: 'IE', label: 'Ireland', value: 3 },
        { id: 'other', label: 'Other', value: 2 },
    ],
    cities: [
        { id: 'stjohns', label: 'St. John’s', value: 41 },
        { id: 'halifax', label: 'Halifax', value: 16 },
        { id: 'toronto', label: 'Toronto', value: 12 },
        { id: 'awaiting', label: 'City breakout', value: null, state: 'awaiting' },
    ],
    ages: [
        { id: '18-24', label: '18–24', value: 34 },
        { id: '25-34', label: '25–34', value: 41 },
        { id: '35-44', label: '35–44', value: 17 },
        { id: '45+', label: '45+', value: 8 },
    ],
    activityHours: [4, 3, 2, 2, 3, 6, 10, 14, 18, 16, 12, 11, 13, 15, 22, 28, 36, 44, 52, 48, 40, 28, 16, 8],
};

export const COMMUNITY = {
    incomingComments: 842,
    incomingMessages: 126,
    incomingMentions: 94,
    openQuestions: 38,
    eligibleConversations: 410,
    respondedConversations: 328,
    responseRate: 80,
    medianFirstReplyMinutes: 42,
    p90FirstReplyMinutes: 186,
    observationCutoff: '2026-11-11T08:00:00-03:30',
    unclassified: 48,
    classified: 794,
    eligibleComments: 842,
    positive: 460,
    neutral: 214,
    negative: 96,
    mixed: 24,
    unresolvedTopics: ['Merch restock', 'Shuttle after 1am', 'Accessible viewing'],
    businessHours: 'Tue–Sat 12:00–22:00 America/St_Johns (mock policy)',
};

export const CONTENT_THEMES = [
    { id: 'lineup', label: 'Lineup', posts: 6, interactions: 21400, typicalRate: 4.8, networks: ['instagram', 'tiktok'] },
    { id: 'tickets', label: 'Tickets / GA', posts: 4, interactions: 3200, typicalRate: 2.1, networks: ['instagram', 'facebook'] },
    { id: 'merch', label: 'Merch', posts: 3, interactions: 2100, typicalRate: 3.4, networks: ['instagram'] },
    { id: 'behind-the-scenes', label: 'Behind the scenes', posts: 3, interactions: 1800, typicalRate: 2.6, networks: ['youtube', 'instagram'] },
    { id: 'logistics', label: 'Logistics', posts: 2, interactions: 4100, typicalRate: 5.1, networks: ['tiktok'] },
];

export const FAN_MENTIONS = LISTENING_MENTIONS.map((mention) => ({
    ...mention,
    postTitle: mention.topic === 'transit' ? 'Transit guide' : mention.topic === 'merch' ? 'Aurora After Dark Reel' : 'Fog City strobe',
    postId: mention.topic === 'transit' ? 'tt-questions' : mention.topic === 'merch' ? 'ig-reel-aurora' : 'tt-fog-drop',
}));

export const INSIGHTS = [
    {
        id: 'reels-shares',
        text: 'Seven Reels accounted for 63% of shares across 25 Instagram posts, up from 41% in the previous period.',
        to: { view: 'posts', params: { platform: 'instagram', format: 'reel' } },
    },
    {
        id: 'aurora-stock',
        text: 'The Aurora After Dark Reel reached the 82nd percentile of comparable Reels while 18 of 121 classified comments criticised merch stock.',
        to: { view: 'post', postId: 'ig-reel-aurora', params: { theme: 'Complaints about limited stock' } },
    },
    {
        id: 'listening-spike',
        text: 'Public mentions jumped 85% on 28 Oct after the Aurora and Fog City clips, driven by 4 of 5 sampled sources in the Northlight query.',
        to: { view: 'listening', params: { spike: LISTENING_SPIKE_DATE } },
    },
];

export const SAVED_VIEWS = [
    { id: 'weekly-exec', name: 'Weekly executive summary', filters: 'Last 28 days · all accounts · combined', stub: true },
    { id: 'reels-only', name: 'Instagram Reels', filters: 'Instagram · reel · organic', stub: true },
];

export const engagementTotal = (post) => {
    const saves = post.saves.state === 'ok' ? post.saves.value : 0;
    return post.likes + post.commentsCount + post.shares + (saves || 0);
};

export const engagementRateByReach = (post) => {
    if (post.reach.state !== 'ok' || !post.reach.value) return null;
    return (engagementTotal(post) / post.reach.value) * 100;
};

export const positiveShare = (post) => {
    if (!post.classifiedComments) return null;
    if (post.classifiedComments < 20) return null;
    return (post.positiveComments / post.classifiedComments) * 100;
};

const inCurrentWindow = (iso) => {
    const day = iso.slice(0, 10);
    return day >= CURRENT_RANGE.start && day <= CURRENT_RANGE.end;
};

/**
 * @param {{accountId?:string, platform?:string, distribution?:string, format?:string, theme?:string, range?:string|number}} filters
 */
export const selectDashboard = (filters = {}) => {
    const accountId = filters.accountId && filters.accountId !== 'all' ? filters.accountId : null;
    const platformIds = parsePlatformFilter(filters.platform);
    const distribution = filters.distribution && filters.distribution !== 'all' ? filters.distribution : null;
    const format = filters.format && filters.format !== 'all' ? filters.format : null;
    const theme = filters.theme || null;
    const rangeDays = [7, 28, 90].includes(Number(filters.range)) ? Number(filters.range) : 28;
    const rangeStart = addDaysIso(RANGE_END, -(rangeDays - 1));

    const accounts = ACCOUNTS.filter((account) => (
        (!accountId || account.id === accountId)
        && (!platformIds.length || platformIds.includes(account.platform))
    ));
    const accountIds = new Set(accounts.map((account) => account.id));

    const posts = POSTS.filter((post) => (
        accountIds.has(post.accountId)
        && (!distribution || post.distribution === distribution)
        && (!format || post.format === format)
        && (!theme || post.themes.includes(theme) || post.comments.some((comment) => comment.theme === theme))
    ));

    const publishedInPeriod = posts.filter((post) => {
        const day = post.publishedAt.slice(0, 10);
        return day >= rangeStart && day <= RANGE_END;
    });

    const sumFull = () => {
        const byDate = new Map();
        accounts.forEach((account) => {
            ACCOUNT_SERIES[account.id].full.forEach((point) => {
                const current = byDate.get(point.date) || {
                    date: point.date,
                    impressions: 0,
                    engagements: 0,
                    clicks: 0,
                    netFollowers: 0,
                    postsPublished: 0,
                    mentions: 0,
                };
                current.impressions += point.impressions;
                current.engagements += point.engagements;
                current.clicks += point.clicks;
                current.netFollowers += point.netFollowers;
                current.postsPublished += point.postsPublished;
                current.mentions += point.mentions;
                byDate.set(point.date, current);
            });
        });
        return [...byDate.values()];
    };

    const fullSeries = sumFull();
    const currentSeries = fullSeries.slice(-rangeDays);
    const priorSeries = fullSeries.slice(-rangeDays * 2, -rangeDays);
    const sumField = (series, field) => series.reduce((total, point) => total + point[field], 0);
    const gained = (series) => series.reduce((total, point) => total + Math.max(point.netFollowers, 0), 0);

    const impressions = sumField(currentSeries, 'impressions');
    const impressionsPrior = sumField(priorSeries, 'impressions');
    const engagements = sumField(currentSeries, 'engagements');
    const engagementsPrior = sumField(priorSeries, 'engagements');
    const clicks = sumField(currentSeries, 'clicks');
    const clicksPrior = sumField(priorSeries, 'clicks');
    const newFollowers = gained(currentSeries);
    const newFollowersPrior = gained(priorSeries);
    const netFollowers = accounts.reduce((total, account) => total + (account.followersClose - account.followersOpen), 0);
    const netFollowersPrior = Math.round(netFollowers * 0.66);
    const reachForRate = posts.reduce((total, post) => total + (post.reach.state === 'ok' ? post.reach.value : 0), 0);
    const engagementsForRate = posts.reduce((total, post) => total + engagementTotal(post), 0);
    const peopleReachedAvailable = accounts.some((account) => account.reachState === 'ok');

    const kpis = {
        impressions: { current: impressions, prior: impressionsPrior, sparkline: currentSeries.map((point) => point.impressions) },
        engagements: { current: engagements, prior: engagementsPrior, sparkline: currentSeries.map((point) => point.engagements) },
        engagementRate: {
            current: reachForRate ? (engagementsForRate / reachForRate) * 100 : null,
            prior: 3.74,
            denominator: 'reach',
            sparkline: currentSeries.map((point) => (point.impressions ? (point.engagements / point.impressions) * 100 : 0)),
        },
        netFollowers: { current: netFollowers, prior: netFollowersPrior, sparkline: currentSeries.map((point) => point.netFollowers) },
        clicks: { current: clicks, prior: clicksPrior, sparkline: currentSeries.map((point) => point.clicks) },
        postsPublished: { current: publishedInPeriod.length, prior: Math.max(publishedInPeriod.length - 3, 0), sparkline: currentSeries.map((point) => point.postsPublished) },
        peopleReached: { current: impressions, prior: impressionsPrior, available: peopleReachedAvailable },
        likesCommentsShares: { current: engagements, prior: engagementsPrior },
        newFollowers: { current: newFollowers, prior: newFollowersPrior },
        linkClicks: { current: clicks, prior: clicksPrior },
    };

    const scorecard = accounts.map((account) => {
        const accountPosts = posts.filter((post) => post.accountId === account.id);
        const series = ACCOUNT_SERIES[account.id].full.slice(-rangeDays);
        const reachState = account.reachState;
        return {
            ...account,
            audienceChange: gained(series),
            output: accountPosts.filter((post) => post.publishedAt.slice(0, 10) >= rangeStart).length,
            exposure: reachState === 'unavailable' ? cell(null, 'unavailable') : cell(sumField(series, 'impressions'), reachState),
            interaction: cell(sumField(series, 'engagements')),
            clicks: cell(sumField(series, 'clicks')),
        };
    });

    return {
        accounts,
        posts,
        publishedInPeriod,
        currentSeries,
        priorSeries,
        rangeDays,
        kpis,
        scorecard,
        insights: INSIGHTS,
        filters: { accountId: accountId || 'all', platform: platformIds.join(',') || 'all', distribution: distribution || 'all', format: format || 'all', theme },
    };
};

export const getPostById = (postId) => POSTS.find((post) => post.id === postId) || null;

export const getAccountById = (accountId) => ACCOUNTS.find((account) => account.id === accountId) || null;
