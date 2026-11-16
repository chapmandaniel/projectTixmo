// Labs demo: promoter-facing security report, generated on the client from a
// fixed daily seed so it always looks current ("last checked N min ago") and
// stays the same across reloads. Names, devices and events match the
// Northlight Live Labs seed. This is fake data — no credentials are stored
// here and nothing is sent to a breach or password API.
import { Archive, Bot, Cloud, CreditCard, Globe, KeyRound, Lock, ScanLine, Shield, ShieldCheck, Timer } from 'lucide-react';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const daySeed = (now) => {
    const d = new Date(now);
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
};

const prng = (seed) => {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export const SCAN_INTERVAL_MINUTES = 5;

// Checks run every 5 minutes and finish about a minute after they start.
export const lastScanAt = (now) => {
    const t = now - MINUTE;
    return new Date(t - (t % (SCAN_INTERVAL_MINUTES * MINUTE)) + MINUTE);
};

export const relativeTime = (from, now) => {
    const diff = Math.max(0, now - from);
    if (diff < MINUTE) return 'just now';
    if (diff < HOUR) {
        const m = Math.round(diff / MINUTE);
        return `${m} min ago`;
    }
    if (diff < 24 * HOUR) {
        const h = Math.round(diff / HOUR);
        return `${h} hr ago`;
    }
    const d = Math.round(diff / (24 * HOUR));
    return `${d} day${d === 1 ? '' : 's'} ago`;
};

// Seed roster: Avery (owner) + 21 listed members, including 3 pending invites.
export const TEAM_ROSTER = [
    { id: 'avery', name: 'Avery Quinlan', role: 'Owner', title: 'Head of Live Operations', status: 'active' },
    { id: 'priya', name: 'Priya Raman', role: 'Admin', title: 'Director of Finance & Operations', status: 'active' },
    { id: 'tomas', name: 'Tomas Reyes', role: 'Admin', title: 'General Manager', status: 'active' },
    { id: 'jordan', name: 'Jordan Okafor', role: 'Manager', title: 'Marketing Lead', status: 'active' },
    { id: 'sofia', name: 'Sofia Marchetti', role: 'Manager', title: 'Production Manager', status: 'active' },
    { id: 'grace', name: 'Grace Whelan', role: 'Manager', title: 'Venue Operations Manager', status: 'active' },
    { id: 'nathan', name: 'Nathan Pike', role: 'Manager', title: 'Box Office Manager', status: 'active' },
    { id: 'liam', name: 'Liam Byrne', role: 'Team member', title: 'Box Office Coordinator', status: 'active', issue: 'weak' },
    { id: 'hana', name: 'Hana Sato', role: 'Team member', title: 'Social & Content Producer', status: 'active' },
    { id: 'marcus', name: 'Marcus Bell', role: 'Team member', title: 'Ticketing Operations', status: 'active', issue: 'leak-resolved' },
    { id: 'imogen', name: 'Imogen Hart', role: 'Team member', title: 'Graphic Designer', status: 'active' },
    { id: 'kwame', name: 'Kwame Mensah', role: 'Team member', title: 'Artist Liaison', status: 'active' },
    { id: 'lucia', name: 'Lucia Ferreira', role: 'Team member', title: 'Marketing Coordinator', status: 'active' },
    { id: 'owen', name: 'Owen Murphy', role: 'Team member', title: 'Box Office Associate', status: 'active' },
    { id: 'rachel', name: 'Rachel Tobin', role: 'Team member', title: 'Hospitality & VIP Lead', status: 'active' },
    { id: 'chloe', name: 'Chloe Dubois', role: 'Team member', title: 'Partnerships Associate', status: 'pending' },
    { id: 'ethan', name: 'Ethan Clarke', role: 'Team member', title: 'Sponsorship Manager', status: 'pending' },
    { id: 'dev', name: 'Dev Kapoor', role: 'Scanner', title: 'Door & Access Lead', status: 'active' },
    { id: 'fiona', name: 'Fiona Walsh', role: 'Scanner', title: 'Door Supervisor', status: 'active' },
    { id: 'sean', name: 'Sean Power', role: 'Scanner', title: 'Door Staff', status: 'active', issue: 'weak' },
    { id: 'maya', name: 'Maya Kowalski', role: 'Scanner', title: 'Door Staff', status: 'active' },
    { id: 'ben', name: 'Ben Abbott', role: 'Scanner', title: 'Door Staff', status: 'pending' },
];

export const DOOR_DEVICES = [
    { id: 'battery-1', name: 'Battery Club Door 1', place: 'The Battery Club · Kitchen Party Social', status: 'online' },
    { id: 'battery-2', name: 'Battery Club Door 2', place: 'The Battery Club · Kitchen Party Social', status: 'online' },
    { id: 'gate-a', name: 'Main Gate A', place: 'Harbourfront Commons · Harbour Lights Festival', status: 'online' },
    { id: 'gate-b', name: 'Main Gate B', place: 'Harbourfront Commons · Harbour Lights Festival', status: 'online' },
    { id: 'vip', name: 'VIP Lane', place: 'Harbourfront Commons · Harbour Lights Festival', status: 'online' },
    { id: 'lantern', name: 'Lantern Room Door', place: 'The Lantern Room · Aurora After Dark', status: 'online' },
    { id: 'foundry-n', name: 'Foundry North', place: 'Foundry Hall · Fog City Strobe', status: 'online' },
    { id: 'foundry-s', name: 'Foundry South', place: 'Foundry Hall · Fog City Strobe', status: 'online' },
    { id: 'gower', name: 'Gower Lobby', place: 'Gower Street Theatre · Late Show Comedy Club', status: 'online' },
    { id: 'chapel', name: 'Chapel Street Door', place: 'Chapel Street Studio · Saltwater Sessions: Mara Vale', status: 'online' },
    { id: 'tablet-1', name: 'Box Office Tablet 1', place: 'Box office', status: 'online' },
    { id: 'tablet-2', name: 'Box Office Tablet 2', place: 'Box office', status: 'online' },
    { id: 'signal', name: 'Signal Hill Gate', place: 'Signal Hill Amphitheatre · paused on purpose', status: 'paused' },
    { id: 'lost-ipad', name: 'Old iPad (lost)', place: 'Revoked after it was reported lost', status: 'revoked' },
];

const SURFACE_DEFS = [
    {
        id: 'website',
        name: 'Event websites & ticket pages',
        icon: Globe,
        metricLabel: 'Page visits reviewed',
        filterLabel: 'Unexpected page changes',
        base: 18400,
        filtered: [0, 0],
        status: 'Every public event and ticket page is up. HTTPS is valid (renews in 76 days). No defacement or unexpected page changes.',
        checks: [
            '19 event and ticket pages online · 100% uptime today',
            'HTTPS valid on every public page',
            'No defacement or unexpected edits to your pages',
            'Unwanted traffic is stopped automatically — see Suspected Attacks and Protection Layers',
        ],
        meaning: 'Buyers can reach your events over a secure connection. Attempts to flood, scrape or probe your pages are stopped automatically and listed under Suspected Attacks.',
    },
    {
        id: 'account',
        name: 'Dashboard account safety',
        icon: KeyRound,
        metricLabel: 'Team sign-ins',
        filterLabel: 'Failed sign-ins stopped',
        base: 48,
        filtered: [4, 11],
        status: '19 of 19 active team members use two-factor sign-in. The 3 pending invites will set up 2FA when they join. New-device sign-ins were reviewed and look like your people.',
        checks: [
            '19 of 19 active members use two-factor sign-in',
            '3 pending invites (Chloe Dubois, Ethan Clarke, Ben Abbott) will set up 2FA when they join',
            'New-device and new-location sign-ins reviewed',
            'Failed sign-ins are stopped automatically — details are in Suspected Attacks',
            'Role and permission changes only by authorized admins',
            'Door and box-office keys are current; the lost iPad key stays revoked',
            'Open sessions: Avery Quinlan, Priya Raman, Nathan Pike, Dev Kapoor',
        ],
        meaning: 'Only your Northlight Live team can open the dashboard, and unusual sign-ins are reviewed so you can see them here.',
    },
    {
        id: 'checkout',
        name: 'Payment & checkout safety',
        icon: CreditCard,
        metricLabel: 'Checkouts screened',
        filterLabel: 'Held for review',
        base: 160,
        filtered: [0, 0],
        status: 'Every checkout is screened for fraud. No chargeback-risk flags in the last 24 hours. Card numbers are not stored on your account.',
        checks: [
            'Fraud screening on every checkout; card-testing attempts are listed under Suspected Attacks',
            '0 chargeback-risk flags in the last 24 hours',
            'Card numbers handled by your payment processor, never stored on your account',
            'Refunds matched to the original payment',
        ],
        meaning: 'Buyers can pay with confidence, and you never hold their card numbers. Nothing in the last day looks like chargeback risk.',
    },
    {
        id: 'doors',
        name: 'Door devices',
        icon: ScanLine,
        metricLabel: 'Tickets checked at the door',
        filterLabel: 'Duplicate or wrong-event tickets stopped',
        base: 740,
        filtered: [2, 8],
        status: '12 devices are online, including both Battery Club doors for Kitchen Party Social. Signal Hill Gate stays paused. The lost iPad stays revoked.',
        checks: [
            '12 of 14 devices online and ready',
            'Signal Hill Gate is paused, as set',
            'Old iPad (lost) stays revoked and cannot check anyone in',
            'Each ticket admits once; duplicates are stopped at the door',
        ],
        meaning: 'Tonight\'s doors are ready, and a lost or paused device cannot let anyone in.',
    },
];

const between = (rand, [lo, hi]) => lo + Math.floor(rand() * (hi - lo + 1));

const ATTENTION_RANK = { recommended: 0, resolved: 1, clear: 2 };

export const buildTeamHealth = (now = Date.now()) => {
    const leakResetAt = now - 18 * DAY;
    const members = TEAM_ROSTER.map((member, index) => {
        const pending = member.status === 'pending';
        const weakPassword = member.issue === 'weak';
        const leakResolved = member.issue === 'leak-resolved';
        const twoFactor = !pending;
        let leak;
        let nextStep;
        let attention;
        if (pending) {
            leak = { status: 'clear', label: 'Not checked yet', detail: 'Checked against known breach lists after they accept the invite and set a password.' };
            nextStep = { label: 'They will set up 2FA when they accept the invite.', action: 'Resend invite' };
            attention = 'recommended';
        } else if (weakPassword) {
            leak = { status: 'clear', label: 'Not on known breach lists', detail: 'Checked against known breach lists — no match.' };
            nextStep = { label: 'Ask them to choose a longer, less common password.', action: 'Send reminder' };
            attention = 'recommended';
        } else if (leakResolved) {
            leak = {
                status: 'resolved',
                label: 'Match already reset',
                detail: `Appeared on a known breach list; already reset ${relativeTime(leakResetAt, now)}. No further action needed.`,
            };
            nextStep = { label: 'Already reset. No further action needed.', action: null };
            attention = 'resolved';
        } else {
            leak = { status: 'clear', label: 'Not on known breach lists', detail: 'Checked against known breach lists — no match.' };
            nextStep = { label: 'No action needed.', action: null };
            attention = 'clear';
        }
        return {
            id: member.id,
            name: member.name,
            role: member.role,
            title: member.title,
            status: member.status,
            twoFactor,
            weakPassword,
            leak,
            nextStep,
            attention,
            index,
        };
    }).sort((a, b) => ATTENTION_RANK[a.attention] - ATTENTION_RANK[b.attention] || a.index - b.index);

    const active = members.filter((m) => m.status === 'active');
    const pending = members.filter((m) => m.status === 'pending');
    const weak = members.filter((m) => m.weakPassword);
    const leakResolved = members.filter((m) => m.leak.status === 'resolved');
    const twoFactorOn = members.filter((m) => m.twoFactor);
    const withoutTwoFactor = members.filter((m) => !m.twoFactor);
    const allClear = members.filter((m) => m.attention === 'clear' || m.attention === 'resolved');

    return {
        members,
        totals: {
            roster: members.length,
            active: active.length,
            pending: pending.length,
            twoFactorOn: twoFactorOn.length,
            withoutTwoFactor: withoutTwoFactor.length,
            weakPasswords: weak.length,
            leakResolved: leakResolved.length,
            leakCurrent: 0,
            allClear: allClear.length,
            actionRecommended: members.filter((m) => m.attention === 'recommended').length,
        },
        pendingNames: pending.map((m) => m.name),
        weakNames: weak.map((m) => m.name),
        leakResolvedNames: leakResolved.map((m) => m.name),
    };
};


// Documentation-only IPv4 ranges (RFC 5737). Never use real addresses here.
export const DOC_IP_RANGES = ['192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24'];

const ATTACK_DEFS = [
    { minutes: 18, kind: 'Credential stuffing', target: 'Northlight Live dashboard sign-in', range: '203.0.113.0/24', country: 'Netherlands', status: 'Blocked', note: '86 repeated sign-in tries. None reached a team account.' },
    { minutes: 52, kind: 'Scalper bot burst', target: 'Harbour Lights Festival ticket page', range: '198.51.100.0/24', country: 'Germany', status: 'Blocked', note: 'Automated ticket-buying traffic was filtered before it reached buyers.' },
    { minutes: 3 * 60 + 10, kind: 'Card-testing', target: 'Checkout', range: '192.0.2.0/24', country: 'Singapore', status: 'Blocked', note: '12 test charges were stopped. No orders were created.' },
    { minutes: 5 * 60 + 20, kind: 'Request flood', target: 'Event and ticket pages', range: '203.0.113.0/24', country: 'United States', status: 'Mitigated', note: 'A short burst of requests was absorbed. Your pages stayed up.' },
    { minutes: 8 * 60 + 5, kind: 'SQL or script injection probe', target: 'Event websites', range: '192.0.2.0/24', country: 'Brazil', status: 'Blocked', note: 'Stopped at the web application firewall. No pages were changed.' },
    { minutes: 11 * 60 + 15, kind: 'Scalper bot burst', target: "New Year's Eve at Harbourfront ticket page", range: '198.51.100.0/24', country: 'Japan', status: 'Blocked', note: 'Bot traffic was filtered. The on-sale page stayed available to buyers.' },
    { minutes: 14 * 60 + 40, kind: 'Credential stuffing', target: 'Northlight Live dashboard sign-in', range: '192.0.2.0/24', country: 'Germany', status: 'Blocked', note: 'Repeated sign-in tries were rate-limited. No accounts were reached.' },
    { minutes: 19 * 60 + 8, kind: 'SQL or script injection probe', target: 'Ticket pages', range: '203.0.113.0/24', country: 'Netherlands', status: 'Blocked', note: 'Script-injection probes were stopped before they reached your pages.' },
    { minutes: 22 * 60 + 25, kind: 'Card-testing', target: 'Checkout', range: '198.51.100.0/24', country: 'United States', status: 'Blocked', note: 'Card-testing was stopped by fraud screening. No payments went through.' },
    { minutes: 27 * 60 + 12, kind: 'Request flood', target: 'Kitchen Party Social event page', range: '192.0.2.0/24', country: 'Singapore', status: 'Mitigated', note: 'The flood was absorbed. The event page stayed up.' },
];

export const PROTECTION_LAYER_DEFS = [
    { id: 'waf', name: 'Web application firewall (WAF)', icon: Shield, note: 'Stops probes such as SQL or script injection before they reach your event pages.' },
    { id: 'ddos', name: 'DDoS protection', icon: Cloud, note: 'Absorbs request floods so your event and ticket pages stay available to buyers.' },
    { id: 'bots', name: 'Bot and scalper defense', icon: Bot, note: 'Filters automated browsing and ticket-buying so real fans can get through.' },
    { id: 'rate', name: 'Rate limiting', icon: Timer, note: 'Caps repeated requests to sign-in and checkout so one source cannot overwhelm them.' },
    { id: 'tls', name: 'SSL/TLS encryption', icon: Lock, note: 'Keeps traffic to your event pages and dashboard private. Certificates renew in 76 days.' },
    { id: 'fraud', name: 'Fraud screening', icon: CreditCard, note: 'Checks each checkout for card-testing and unusual payments before an order is created.' },
    { id: 'login', name: 'Login protection and 2FA', icon: KeyRound, note: 'Stops credential stuffing and requires two-factor sign-in for every active team member.' },
    { id: 'breach', name: 'Breach monitoring', icon: ShieldCheck, note: 'Checks team passwords against known breach lists, without showing the passwords themselves.' },
    { id: 'backups', name: 'Encrypted backups', icon: Archive, note: 'Your Northlight Live data is stored in encrypted backups and can be restored if needed.' },
];

export const isDocumentationRange = (value) => DOC_IP_RANGES.includes(value);

export const buildSuspectedAttacks = (now = Date.now()) => {
    const scanAt = lastScanAt(now);
    const items = ATTACK_DEFS.map((item, index) => ({
        id: `attack-${index}`,
        ...item,
        at: new Date(scanAt.getTime() - (item.minutes - 2) * MINUTE),
    }));
    const hours = (entry) => (scanAt.getTime() - entry.at.getTime()) / HOUR;
    const inHours = (limit) => items.filter((entry) => hours(entry) <= limit).length;
    // Visible items are the notable ones; period totals include smaller stopped attempts not listed.
    return {
        items,
        totals: {
            last24h: 14,
            last7d: 61,
            last30d: 214,
            visible24h: inHours(24),
            breached: 0,
            reached: 0,
        },
        summary: 'Every attempt below was stopped automatically. Nothing was breached, and no action is needed from you.',
    };
};

export const buildProtectionLayers = (now = Date.now()) => {
    const scanAt = lastScanAt(now);
    const layers = PROTECTION_LAYER_DEFS.map((layer, index) => ({
        ...layer,
        status: 'Active / Healthy',
        checkedAt: new Date(scanAt.getTime() - (index % 3) * MINUTE),
    }));
    return {
        layers,
        allActive: layers.every((layer) => layer.status === 'Active / Healthy'),
    };
};

export const buildSecurityReport = (now = Date.now()) => {
    const rand = prng(daySeed(now));
    // Share of the day elapsed keeps counts growing through the day instead of jumping.
    const hourOfDay = new Date(now).getHours() + new Date(now).getMinutes() / 60;
    const dayShare = 0.55 + 0.45 * (hourOfDay / 24);
    const team = buildTeamHealth(now);

    const sources = SURFACE_DEFS.map((def) => {
        const events = Math.round(def.base * (0.9 + rand() * 0.2) * (1 + dayShare));
        const blocked = between(rand, def.filtered);
        const trend = Array.from({ length: 14 }, () => Math.round(def.base * (0.75 + rand() * 0.5)));
        return {
            ...def,
            health: 'healthy',
            events,
            blocked,
            trend,
            uptime: def.id === 'website' ? '100%' : null,
        };
    });

    const totals = sources.reduce((acc, s) => ({
        events: acc.events + s.events,
        blocked: acc.blocked + s.blocked,
    }), { events: 0, blocked: 0 });

    const scanAt = lastScanAt(now);
    const feed = [
        { minutes: 2, source: 'website', tone: 'ok', text: 'All 19 event and ticket pages are up, with HTTPS valid' },
        { minutes: 4, source: 'doors', tone: 'ok', text: 'Battery Club Door 1 and Door 2 are online for Kitchen Party Social' },
        { minutes: 7, source: 'account', tone: 'ok', text: 'Dashboard sign-in is protected; recent stuffing attempts are listed under Suspected Attacks' },
        { minutes: 9, source: 'doors', tone: 'protected', text: 'A duplicate ticket was stopped at Battery Club Door 2' },
        { minutes: 11, source: 'checkout', tone: 'ok', text: 'Kitchen Party order NL-003893 passed fraud screening' },
        { minutes: 15, source: 'account', tone: 'ok', text: 'Hana Sato signed in from her usual device' },
        { minutes: 19, source: 'doors', tone: 'ok', text: 'Kitchen Party walk-up sales synced from Box Office Tablet 1' },
        { minutes: 26, source: 'website', tone: 'ok', text: 'Harbour Lights Festival ticket page stayed up; bot traffic is listed under Suspected Attacks' },
        { minutes: 34, source: 'account', tone: 'ok', text: 'Nathan Pike exported the box office report' },
        { minutes: 41, source: 'doors', tone: 'protected', text: 'A ticket for another event was refused at Battery Club Door 1' },
        { minutes: 52, source: 'account', tone: 'reviewed', text: 'New device sign-in for Jordan Okafor was reviewed and looks right' },
        { minutes: 63, source: 'checkout', tone: 'ok', text: 'Refund for order NL-004944 matched its original payment' },
        { minutes: 71, source: 'website', tone: 'ok', text: 'HTTPS on your event pages is valid and renews in 76 days' },
        { minutes: 88, source: 'account', tone: 'ok', text: 'Avery Quinlan approved a role change for Owen Murphy' },
        { minutes: 104, source: 'website', tone: 'ok', text: 'Harbour Lights Festival on-sale traffic reached buyers with pages up the whole time' },
        { minutes: 118, source: 'account', tone: 'ok', text: 'Marcus Bell\'s password was already reset after a known-breach-list match — no further action needed' },
        { minutes: 128, source: 'doors', tone: 'ok', text: 'The lost "Old iPad" stays revoked — no attempted use today' },
        { minutes: 150, source: 'account', tone: 'ok', text: 'Tomas Reyes re-sent an invitation to Ethan Clarke' },
        { minutes: 168, source: 'account', tone: 'reviewed', text: 'Liam Byrne and Sean Power are recommended to choose a stronger password — reminders are ready to send' },
        { minutes: 186, source: 'website', tone: 'ok', text: 'No unexpected changes on any public event or ticket page' },
        { minutes: 214, source: 'account', tone: 'protected', text: 'A password reset was limited after a few tries on one account — your team was not locked out' },
        { minutes: 244, source: 'checkout', tone: 'ok', text: 'Daily payouts matched every paid order; 0 chargeback-risk flags' },
    ].map((item, index) => ({
        id: `feed-${index}`,
        ...item,
        at: new Date(scanAt.getTime() - (item.minutes - 2) * MINUTE),
        sourceName: SURFACE_DEFS.find((s) => s.id === item.source)?.name,
    }));

    const devicesOnline = DOOR_DEVICES.filter((d) => d.status === 'online').length;
    const devicesPaused = DOOR_DEVICES.filter((d) => d.status === 'paused').length;
    const devicesRevoked = DOOR_DEVICES.filter((d) => d.status === 'revoked').length;
    const attacks = buildSuspectedAttacks(now);
    const protection = buildProtectionLayers(now);

    return {
        status: 'healthy',
        scannedAt: scanAt,
        nextScanAt: new Date(scanAt.getTime() + SCAN_INTERVAL_MINUTES * MINUTE),
        windowLabel: 'Last 24 hours',
        meaning: 'Nothing here needs urgent attention. Your event pages are up and locked with HTTPS, your team is signed in safely, checkout is being screened, and tonight\'s door devices are ready. Every suspected attack in the last 30 days was blocked or mitigated, and nothing was breached. Two teammates are recommended to choose a stronger password, and three invites will set up 2FA when they join.',
        sources,
        devices: DOOR_DEVICES,
        team,
        attacks,
        protection,
        totals: {
            ...totals,
            sources: sources.length,
            healthySources: sources.filter((s) => s.health === 'healthy').length,
            openItems: 0,
            pagesOnline: 19,
            pagesTotal: 19,
            twoFactorOn: team.totals.twoFactorOn,
            activeMembers: team.totals.active,
            pendingInvites: team.totals.pending,
            chargebackFlags: 0,
            devicesOnline,
            devicesPaused,
            devicesRevoked,
            devicesTotal: DOOR_DEVICES.length,
        },
        feed,
    };
};
