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

// ---------------------------------------------------------------------------
// Promoter view. The scoring above stays the engine; everything below turns
// it into the three things a promoter asks: is anyone ripping off my fans,
// how bad is it, and what do I do. Plain words, no scores on the page.
// ---------------------------------------------------------------------------

export const PLAIN_KINDS = {
    giveaway: 'Fake giveaway',
    impersonator: 'Fake account posing as you',
    resale: 'Resale scam',
    phishing: 'Fake login page',
    counterfeit: 'Fake tickets for sale',
    fan: 'Fan page',
    reseller: 'Fan reselling a ticket',
};

export const plainKind = (finding) => PLAIN_KINDS[finding?.kind] || finding?.kindLabel || 'Suspicious post';

// Poster art already served with the Labs dashboard (tdash/public/demo-assets).
const EVENT_POSTER_KEYS = {
    'Harbour Lights Festival': 'harbour',
    'Aurora After Dark': 'aurora',
    'Kitchen Party Social': 'kitchen',
    'Late Show Comedy Club': 'comedy',
    'Saltwater Sessions: Mara Vale': 'saltwater',
    'Winter Lanterns Gala': 'gala',
    'Iceberg Alley Jazz Brunch': 'jazz',
};
export const eventPoster = (eventName) => (EVENT_POSTER_KEYS[eventName] ? `/demo-assets/${EVENT_POSTER_KEYS[eventName]}-poster.svg` : '');

export const BUCKETS = {
    needs: { id: 'needs', label: 'Needs you' },
    look: { id: 'look', label: 'Worth a look' },
    handled: { id: 'handled', label: 'Handled' },
    fine: { id: 'fine', label: 'Looks fine' },
};
export const BUCKET_ORDER = ['needs', 'look', 'handled', 'fine'];

/** Where a finding sits for the promoter: waiting on them, worth a glance, dealt with, or harmless. */
export const bucketOf = (finding) => {
    if (finding.verdict === 'safe') return 'fine';
    if (finding.status === 'reported' || finding.status === 'resolved') return 'handled';
    return finding.verdict === 'scam' ? 'needs' : 'look';
};

export const countBuckets = (findings) => {
    const counts = { needs: 0, look: 0, handled: 0, fine: 0 };
    (findings || []).forEach((finding) => { counts[bucketOf(finding)] += 1; });
    return counts;
};

/** How many people a post or page can reach, when the capture says so. */
export const reachPeople = (finding) => {
    const text = String(finding?.reach || '');
    const match = text.match(/([\d.]+)\s*(k)?\s*(followers|views)/i) || text.match(/group of\s*([\d.]+)\s*(k)?/i);
    if (!match) return 0;
    return Math.round(Number(match[1]) * (match[2] ? 1000 : 1));
};

const people = (value) => new Intl.NumberFormat('en-CA').format(Math.round(value / 100) * 100 || value);

export const reachWords = (finding) => {
    const count = reachPeople(finding);
    return count ? `Could reach about ${people(count)} people` : finding.reach;
};

/** How sure Moose is, in words and as a 1-5 level for the dots. Never a number on the page. */
export const sureness = (finding) => {
    const score = finding?.score || 0;
    const level = Math.max(1, Math.min(5, Math.ceil(score / 20)));
    if (finding?.verdict === 'safe') return { level, label: 'Looks fine' };
    if (score >= 85) return { level, label: 'Almost certainly a scam' };
    if (score >= 70) return { level, label: 'Very likely a scam' };
    return { level, label: 'Might be a scam' };
};

const HARM = /^(asks|collects|charges|wants|payment|winners|fake|claims|links to a look-alike|poses|lists more|barcode)/i;
const GOOD = /official|face.value|warns fans|personal fan|active for|years old/i;

/** The one line that says what this does to fans: the harm if there is one, otherwise the strongest sign. */
export const mainReason = (finding) => {
    const signals = [...(finding?.signals || [])].sort((a, b) => b.points - a.points);
    if (finding?.verdict === 'safe') return (signals.find((signal) => GOOD.test(signal.label)) || signals[signals.length - 1])?.label || '';
    const harm = signals.find((signal) => signal.points > 0 && HARM.test(signal.label));
    return (harm || signals[0])?.label || '';
};

const STARTS_WITH_VERB = /^(asks|collects|charges|wants|poses|claims|lists|links|uses|copies|reuses|replies|runs)\b/i;

/** "a fake giveaway on Instagram that asks entrants for card details by DM" */
export const describeFinding = (finding) => {
    const kind = plainKind(finding).toLowerCase();
    const what = `${finding.kind === 'counterfeit' ? '' : 'a '}${kind} on ${finding.platform === 'web' ? 'the web' : finding.platformLabel}`;
    const reason = mainReason(finding);
    if (!reason) return what;
    const clause = reason[0].toLowerCase() + reason.slice(1);
    return STARTS_WITH_VERB.test(reason) ? `${what} that ${clause}` : `${what}: ${clause}`;
};

/** The step Moose recommends, so each card carries one clear button. */
export const nextStep = (finding) => {
    const bucket = bucketOf(finding);
    if (bucket === 'fine') return null;
    if (bucket === 'handled') {
        if (finding.status === 'resolved') return { id: 'done', label: finding.resolution || 'Resolved' };
        return { id: 'waiting', label: `Reported. Waiting on ${finding.platform === 'web' ? 'the host' : finding.platformLabel}` };
    }
    if (bucket === 'look') return { id: 'open', label: 'Take a look' };
    if (finding.platform === 'web') return { id: 'takedown', label: 'Get it taken down' };
    return { id: 'report', label: `Report to ${finding.platformLabel}` };
};

/** One row per event that anything was found for, most in need first. */
export const groupByEvent = (findings) => {
    const groups = new Map();
    (findings || []).forEach((finding) => {
        const group = groups.get(finding.event) || { event: finding.event, poster: eventPoster(finding.event), needs: 0, look: 0, handled: 0, fine: 0, reach: 0, total: 0 };
        const bucket = bucketOf(finding);
        group[bucket] += 1;
        group.total += 1;
        if (bucket === 'needs') group.reach += reachPeople(finding);
        groups.set(finding.event, group);
    });
    return [...groups.values()].sort((a, b) => b.needs - a.needs || b.look - a.look || b.total - a.total || a.event.localeCompare(b.event));
};

const listed = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/**
 * Moose speaks first: a headline and a few plain lines about what is out there.
 * @returns {{ tone: 'bad'|'watch'|'good', pill: string, headline: string, lines: string[] }}
 */
export const buildScamRead = (findings) => {
    const list = findings || [];
    const needs = list.filter((finding) => bucketOf(finding) === 'needs').sort((a, b) => b.score - a.score);
    const counts = countBuckets(list);
    const waiting = list.filter((finding) => finding.status === 'reported').length;
    const gone = list.filter((finding) => finding.status === 'resolved' && finding.verdict !== 'safe').length;
    const handledLine = counts.handled
        ? `${[waiting ? `${waiting} ${waiting === 1 ? 'is' : 'are'} reported and waiting on the platform` : '', gone ? `${gone} ${gone === 1 ? 'is' : 'are'} already gone` : ''].filter(Boolean).join(', and ')}.`
        : '';

    if (needs.length) {
        const reach = needs.reduce((sum, finding) => sum + reachPeople(finding), 0);
        const worst = needs[0];
        const targets = groupByEvent(needs);
        const lines = [`The worst is ${describeFinding(worst)}.`];
        if (targets.length > 1) lines.push(`${targets[0].event} is the main target${targets[0].needs > 1 ? `, with ${targets[0].needs} of them` : ''}.`);
        lines.push(`I have written the report for ${needs.length === 1 ? 'it' : 'each one'}, and a warning you can send to ticket holders.`);
        return {
            tone: 'bad',
            pill: `${needs.length} ${needs.length === 1 ? 'scam needs' : 'scams need'} you`,
            headline: `${needs.length} ${needs.length === 1 ? 'scam is' : 'scams are'} live${reach ? ` and could reach about ${people(reach)} people` : ' right now'}.`,
            lines,
        };
    }
    if (counts.look) {
        return {
            tone: 'watch',
            pill: `${counts.look} worth a look`,
            headline: 'Nothing dangerous is waiting on you.',
            lines: [`${counts.look} ${counts.look === 1 ? 'post is' : 'posts are'} worth a look, but ${counts.look === 1 ? 'it does' : 'they do'} not look like outright scams.`, handledLine].filter(Boolean),
        };
    }
    return {
        tone: 'good',
        pill: 'All clear',
        headline: 'All clear. Nobody out there is pretending to be you.',
        lines: [handledLine, counts.fine ? `${counts.fine} fan ${counts.fine === 1 ? 'page or resale looks' : 'pages and resales look'} fine.` : ''].filter(Boolean),
    };
};

export { listed as joinPlain };
