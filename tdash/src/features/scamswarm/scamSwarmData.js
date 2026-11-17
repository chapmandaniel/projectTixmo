// Labs demo: ScamSwarm brand-protection monitor. Everything here is fake,
// client-side seed data. Handles are invented, every link uses a reserved
// .example domain, and nothing is scraped or fetched.

export const VERDICTS = {
    scam: { id: 'scam', label: 'Likely scam', min: 70 },
    attention: { id: 'attention', label: 'Needs attention', min: 35 },
    safe: { id: 'safe', label: 'Likely safe', min: 0 },
};

export const VERDICT_ORDER = ['scam', 'attention', 'safe'];

export const STATUSES = [
    { id: 'new', label: 'New' },
    { id: 'in_review', label: 'In review' },
    { id: 'reported', label: 'Reported' },
    { id: 'resolved', label: 'Taken down / Resolved' },
];

export const PLATFORMS = {
    instagram: { id: 'instagram', label: 'Instagram' },
    facebook: { id: 'facebook', label: 'Facebook' },
    tiktok: { id: 'tiktok', label: 'TikTok' },
    x: { id: 'x', label: 'X' },
    marketplace: { id: 'marketplace', label: 'Marketplace' },
    web: { id: 'web', label: 'Web' },
};

export const KINDS = {
    giveaway: 'Fake ticket giveaway',
    impersonator: 'Impersonator profile',
    resale: 'Resale scam',
    phishing: 'Phishing look-alike page',
    counterfeit: 'Counterfeit ticket listing',
    fan: 'Fan community post',
    reseller: 'Resale listing',
};

export const ASSIGNEES = [
    { id: 'avery', name: 'Avery Quinlan', title: 'Head of Live Operations' },
    { id: 'jordan', name: 'Jordan Okafor', title: 'Marketing Lead' },
    { id: 'hana', name: 'Hana Sato', title: 'Social & Content Producer' },
    { id: 'nathan', name: 'Nathan Pike', title: 'Box Office Manager' },
    { id: 'lucia', name: 'Lucia Ferreira', title: 'Marketing Coordinator' },
];

export const OFFICIAL = {
    name: 'Northlight Live',
    handle: '@northlightlive',
    site: 'tickets.tixmo.example/northlight',
};

const F = (finding) => finding;

export const SEED_FINDINGS = [
    F({
        id: 'ss-101',
        kind: 'giveaway',
        platform: 'instagram',
        handle: '@northIight.giveaways',
        displayName: 'Northlight Giveaways ✨',
        url: 'https://instagram.example/northIight.giveaways',
        event: 'Harbour Lights Festival',
        minutesAgo: 22,
        reach: '4.1k followers',
        caption: '🎉 FREE VIP PAIRS for Harbour Lights! Follow, tag 3 friends and DM us your card to "verify" your entry. Ends tonight!',
        mediaText: 'WIN 2 VIP PASSES',
        stats: { likes: '1.2k', comments: '318' },
        signals: [
            { label: 'Handle swaps an l for a capital I (northIight)', points: 30 },
            { label: 'Asks entrants for card details by DM', points: 30 },
            { label: 'Uses the official Harbour Lights poster', points: 15 },
            { label: 'Account created 6 days ago', points: 12 },
            { label: 'Not linked from any official Northlight channel', points: 8 },
        ],
        status: 'new',
    }),
    F({
        id: 'ss-102',
        kind: 'phishing',
        platform: 'web',
        handle: 'northlight-tickets-login.example',
        displayName: 'Northlight Live — Ticket Login',
        url: 'https://northlight-tickets-login.example/harbour-lights/checkout',
        event: 'Harbour Lights Festival',
        minutesAgo: 47,
        reach: 'Shared in 9 comment threads',
        caption: 'Sign in to claim your Harbour Lights upgrade. Enter your email, password and card to continue.',
        mediaText: 'Sign in to Northlight',
        stats: { likes: 'Page', comments: 'Login form' },
        signals: [
            { label: 'Copies the Tixmo checkout layout and Northlight logo', points: 30 },
            { label: 'Domain registered 2 days ago', points: 20 },
            { label: 'Collects passwords and card numbers on one page', points: 25 },
            { label: 'Linked from the fake giveaway account', points: 15 },
        ],
        status: 'in_review',
        assignee: 'nathan',
    }),
    F({
        id: 'ss-103',
        kind: 'counterfeit',
        platform: 'marketplace',
        handle: 'Kyle R. (seller)',
        displayName: '2x Kitchen Party Social GA — PDF',
        url: 'https://marketplace.example/item/kitchen-party-2x-pdf',
        event: 'Kitchen Party Social',
        minutesAgo: 95,
        reach: '312 views',
        caption: '2 GA tickets, PDF sent by email right after e-transfer. Can’t make it. $60 each, no refunds.',
        mediaText: 'PDF TICKETS × 2',
        stats: { likes: '$60 ea', comments: '14 saves' },
        signals: [
            { label: 'Kitchen Party uses mobile wallet tickets only, no PDFs', points: 30 },
            { label: 'Barcode in the photo fails Tixmo format check', points: 25 },
            { label: 'Payment by e-transfer only', points: 15 },
            { label: 'Same photo posted by 3 other sellers', points: 12 },
        ],
        status: 'new',
    }),
    F({
        id: 'ss-104',
        kind: 'impersonator',
        platform: 'facebook',
        handle: 'Northlight Live Events (Official)',
        displayName: 'Northlight Live Events (Official)',
        url: 'https://facebook.example/northlight.live.events.official',
        event: 'Aurora After Dark',
        minutesAgo: 130,
        reach: '1.8k followers',
        caption: 'Aurora After Dark is SOLD OUT on Tixmo, but we released 40 extra tickets here! Message us to buy.',
        mediaText: 'EXTRA TICKETS RELEASED',
        stats: { likes: '640', comments: '211' },
        signals: [
            { label: 'Calls itself "Official" but is not the verified page', points: 25 },
            { label: 'Claims tickets are sold outside Tixmo', points: 25 },
            { label: 'Copies the official profile photo and banner', points: 15 },
            { label: 'Page renamed 3 times this month', points: 12 },
        ],
        status: 'reported',
        assignee: 'hana',
    }),
    F({
        id: 'ss-105',
        kind: 'resale',
        platform: 'x',
        handle: '@tix_drop_nl',
        displayName: 'Tix Drop NL',
        url: 'https://x.example/tix_drop_nl/status/1',
        event: 'Winter Lanterns Gala',
        minutesAgo: 180,
        reach: '920 followers',
        caption: 'Winter Lanterns Gala tables 50% off 🔥 Pay by gift card, tickets transferred same day. DM fast.',
        mediaText: 'GALA TABLES 50% OFF',
        stats: { likes: '88', comments: '19' },
        signals: [
            { label: 'Asks for gift-card payment', points: 30 },
            { label: 'Price far below face value', points: 18 },
            { label: 'Replies to fans under the official Northlight posts', points: 12 },
            { label: 'Account uses a stock profile photo', points: 10 },
        ],
        status: 'new',
    }),
    F({
        id: 'ss-106',
        kind: 'giveaway',
        platform: 'tiktok',
        handle: '@latenightcomedy.free',
        displayName: 'Late Night Comedy Free Tix',
        url: 'https://tiktok.example/@latenightcomedy.free/video/1',
        event: 'Late Show Comedy Club',
        minutesAgo: 260,
        reach: '12k views',
        caption: 'Comment "LAUGH" to win Late Show tickets 😂 Winners pay a $4.99 "processing fee" at the link in bio.',
        mediaText: 'COMMENT TO WIN',
        stats: { likes: '2.3k', comments: '1.1k' },
        signals: [
            { label: 'Winners asked to pay a fee', points: 25 },
            { label: 'Link in bio points to an unrelated payment page', points: 20 },
            { label: 'Runs the same giveaway for other promoters', points: 15 },
            { label: 'No connection to Northlight', points: 10 },
        ],
        status: 'new',
    }),
    F({
        id: 'ss-107',
        kind: 'impersonator',
        platform: 'instagram',
        handle: '@northlight_live_support',
        displayName: 'Northlight Support',
        url: 'https://instagram.example/northlight_live_support',
        event: 'Harbour Lights Festival',
        minutesAgo: 340,
        reach: '260 followers',
        caption: 'Having trouble with your Harbour Lights tickets? DM us your order number and email and we’ll fix it.',
        mediaText: 'SUPPORT TEAM',
        stats: { likes: '31', comments: '12' },
        signals: [
            { label: 'Poses as Northlight support', points: 20 },
            { label: 'Asks fans for order numbers and emails', points: 15 },
            { label: 'Account is 3 weeks old', points: 8 },
        ],
        status: 'new',
    }),
    F({
        id: 'ss-108',
        kind: 'resale',
        platform: 'facebook',
        handle: 'St. John’s Ticket Swap (group)',
        displayName: 'Post in St. John’s Ticket Swap',
        url: 'https://facebook.example/groups/ticket-swap/posts/1',
        event: 'Saltwater Sessions: Mara Vale',
        minutesAgo: 410,
        reach: 'Group of 6.4k',
        caption: 'Selling 1 Saltwater Sessions seat, face value. Can transfer through Tixmo once paid.',
        mediaText: '1 SEAT · FACE VALUE',
        stats: { likes: '6', comments: '4' },
        signals: [
            { label: 'Seller account is 2 weeks old', points: 15 },
            { label: 'Wants payment before the Tixmo transfer', points: 15 },
            { label: 'Asks at face value (good sign)', points: -5 },
            { label: 'Mentions the official Tixmo transfer', points: 15 },
        ],
        status: 'new',
    }),
    F({
        id: 'ss-109',
        kind: 'counterfeit',
        platform: 'web',
        handle: 'cheap-event-seats.example',
        displayName: 'Cheap Event Seats',
        url: 'https://cheap-event-seats.example/aurora-after-dark',
        event: 'Aurora After Dark',
        minutesAgo: 520,
        reach: 'Ranked for "aurora after dark tickets"',
        caption: 'Aurora After Dark — Floor GA from $35. Instant download. Secure checkout.',
        mediaText: 'FLOOR GA FROM $35',
        stats: { likes: 'Resale site', comments: '22 listings' },
        signals: [
            { label: 'Lists more seats than are on sale', points: 20 },
            { label: '"Instant download" for a wallet-only event', points: 15 },
            { label: 'Site is 5 weeks old', points: 10 },
        ],
        status: 'in_review',
        assignee: 'jordan',
    }),
    F({
        id: 'ss-110',
        kind: 'fan',
        platform: 'instagram',
        handle: '@harbourlights.fanclub',
        displayName: 'Harbour Lights Fan Club',
        url: 'https://instagram.example/harbourlights.fanclub',
        event: 'Harbour Lights Festival',
        minutesAgo: 75,
        reach: '8.9k followers',
        caption: 'Lineup drop! 🎶 Tickets only from the official Northlight link — don’t buy from DMs.',
        mediaText: 'LINEUP OUT NOW',
        stats: { likes: '3.4k', comments: '402' },
        signals: [
            { label: 'Links to the official Northlight ticket page', points: 5 },
            { label: 'Account active for 4 years', points: 4 },
            { label: 'Warns fans about scams', points: 3 },
            { label: 'Uses Northlight artwork', points: 8 },
        ],
        status: 'new',
    }),
    F({
        id: 'ss-111',
        kind: 'reseller',
        platform: 'marketplace',
        handle: 'Jen M. (seller)',
        displayName: '2x Iceberg Alley Jazz Brunch',
        url: 'https://marketplace.example/item/jazz-brunch-2x',
        event: 'Iceberg Alley Jazz Brunch',
        minutesAgo: 610,
        reach: '84 views',
        caption: 'Two brunch tickets at face value. Will transfer through Tixmo, happy to meet.',
        mediaText: '2 TICKETS · FACE VALUE',
        stats: { likes: '$48 ea', comments: '3 saves' },
        signals: [
            { label: 'Offers the official Tixmo transfer', points: 4 },
            { label: 'Face-value price', points: 3 },
            { label: 'Seller account 6 years old', points: 3 },
            { label: 'New listing', points: 6 },
        ],
        status: 'new',
    }),
    F({
        id: 'ss-112',
        kind: 'fan',
        platform: 'tiktok',
        handle: '@kitchenparty.memories',
        displayName: 'Kitchen Party Memories',
        url: 'https://tiktok.example/@kitchenparty.memories/video/2',
        event: 'Kitchen Party Social',
        minutesAgo: 720,
        reach: '5.6k views',
        caption: 'Last year’s Kitchen Party was unreal. See you there again! Link to official tickets in bio.',
        mediaText: 'SEE YOU THERE',
        stats: { likes: '640', comments: '48' },
        signals: [
            { label: 'Personal fan account', points: 3 },
            { label: 'Links to the official event page', points: 3 },
            { label: 'Reuses official event video', points: 10 },
        ],
        status: 'new',
    }),
    F({
        id: 'ss-113',
        kind: 'phishing',
        platform: 'x',
        handle: '@northlightlive_help',
        displayName: 'Northlight Live Help',
        url: 'https://x.example/northlightlive_help/status/2',
        event: 'Winter Lanterns Gala',
        minutesAgo: 890,
        reach: '140 followers',
        caption: 'Your Winter Lanterns Gala order is on hold. Verify here within 24h: northlight-verify.example',
        mediaText: 'ORDER ON HOLD',
        stats: { likes: '2', comments: '0' },
        signals: [
            { label: 'Fake "order on hold" message', points: 30 },
            { label: 'Links to a look-alike verify page', points: 25 },
            { label: 'Handle copies the official account', points: 20 },
        ],
        status: 'resolved',
        resolution: 'Taken down',
        assignee: 'hana',
    }),
    F({
        id: 'ss-114',
        kind: 'resale',
        platform: 'facebook',
        handle: 'Aurora After Dark Tickets Buy/Sell',
        displayName: 'Aurora After Dark Tickets Buy/Sell',
        url: 'https://facebook.example/groups/aurora-buy-sell',
        event: 'Aurora After Dark',
        minutesAgo: 1020,
        reach: 'Group of 1.1k',
        caption: 'New group for Aurora After Dark ticket swaps. Admins verify sellers for a small fee.',
        mediaText: 'BUY / SELL GROUP',
        stats: { likes: '1.1k members', comments: '58 posts' },
        signals: [
            { label: 'Charges a "verification fee"', points: 20 },
            { label: 'Group created this week', points: 12 },
            { label: 'Uses the event name and artwork', points: 10 },
        ],
        status: 'new',
    }),
];

export const verdictFor = (score) => {
    if (score >= VERDICTS.scam.min) return 'scam';
    if (score >= VERDICTS.attention.min) return 'attention';
    return 'safe';
};

export const scoreFor = (signals) => {
    const total = (signals || []).reduce((sum, signal) => sum + (signal.points || 0), 0);
    return Math.max(0, Math.min(99, total));
};

export const enrichFinding = (finding) => {
    const score = scoreFor(finding.signals);
    return {
        assignee: null,
        resolution: null,
        whitelisted: false,
        takedownRequested: false,
        fanWarningDraft: false,
        activity: [],
        ...finding,
        score,
        verdict: finding.whitelisted ? 'safe' : verdictFor(score),
        kindLabel: KINDS[finding.kind] || finding.kind,
        platformLabel: PLATFORMS[finding.platform]?.label || finding.platform,
    };
};

export const buildSeedFindings = () => SEED_FINDINGS.map(enrichFinding);

export const summarize = (findings) => {
    const list = findings || [];
    const open = list.filter((f) => f.status !== 'resolved');
    return {
        total: list.length,
        scam: open.filter((f) => f.verdict === 'scam').length,
        attention: open.filter((f) => f.verdict === 'attention').length,
        safe: list.filter((f) => f.verdict === 'safe').length,
        resolved: list.filter((f) => f.status === 'resolved').length,
        reported: list.filter((f) => f.status === 'reported').length,
        inReview: list.filter((f) => f.status === 'in_review').length,
        newCount: list.filter((f) => f.status === 'new').length,
        open: open.length,
    };
};

export const filterFindings = (findings, { verdict = 'all', platform = 'all', event = 'all', status = 'all' } = {}) =>
    (findings || [])
        .filter((f) => verdict === 'all' || f.verdict === verdict)
        .filter((f) => platform === 'all' || f.platform === platform)
        .filter((f) => event === 'all' || f.event === event)
        .filter((f) => status === 'all' || f.status === status)
        .sort((a, b) => b.score - a.score || a.minutesAgo - b.minutesAgo);

export const eventsIn = (findings) => [...new Set((findings || []).map((f) => f.event))].sort();

export const assigneeName = (id) => ASSIGNEES.find((a) => a.id === id)?.name || null;

export const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;

export const minutesLabel = (minutes) => {
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
};

export const reportDraft = (finding) => [
    `Report type: ${finding.kindLabel} / impersonation of ${OFFICIAL.name}`,
    `Reported account or page: ${finding.handle}`,
    `Link: ${finding.url}`,
    `Event affected: ${finding.event}`,
    '',
    `${OFFICIAL.name} is the promoter of ${finding.event}. Tickets are only sold through ${OFFICIAL.site}.`,
    `This ${finding.platformLabel} ${finding.platform === 'web' ? 'site' : 'account'} is not affiliated with us and is misleading fans:`,
    ...finding.signals.filter((s) => s.points > 0).map((s) => `- ${s.label}`),
    '',
    `Contact: ${OFFICIAL.name} brand protection (demo)`,
].join('\n');

export const takedownDraft = (finding) => [
    `Takedown request — ${finding.url}`,
    '',
    `${OFFICIAL.name} requests removal of this content for trademark misuse and fraud targeting buyers of ${finding.event}.`,
    'Evidence: ScamSwarm capture, signals and timestamps attached (demo).',
].join('\n');

export const fanWarningDraft = (finding) => ({
    post: `⚠️ Heads up, ${finding.event} fans: ${finding.handle} on ${finding.platformLabel} is NOT us. We never ask for card details or payment by DM, gift card or e-transfer. Official tickets are only at ${OFFICIAL.site}. If you’ve paid them, contact your bank and reply to this post so we can help.`,
    emailSubject: `Protect your ${finding.event} tickets`,
    emailBody: `Hi there,\n\nWe've spotted a ${finding.kindLabel.toLowerCase()} using the ${finding.event} name (${finding.handle}). It isn't connected to ${OFFICIAL.name}.\n\nOfficial tickets are only sold at ${OFFICIAL.site}, and transfers only happen inside Tixmo. We'll never ask for your password, card number or a gift card.\n\nSee you at the show,\n${OFFICIAL.name}`,
});

export const sweepSummary = {
    sources: ['Instagram', 'Facebook', 'TikTok', 'X', 'Marketplace', 'Web search'],
    lastSweepMinutes: 4,
    mentionsScanned: 18420,
};
