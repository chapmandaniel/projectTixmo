// Labs demo: promoter-facing security report, generated on the client from a
// fixed daily seed so it always looks current ("last checked N min ago") and
// stays the same across reloads. Names, devices and events match the
// Northlight Live Labs seed. This is fake data — no credentials are stored
// here and nothing is sent to a breach or password API.
import { CreditCard, Globe, KeyRound, ScanLine } from 'lucide-react';

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
        filterLabel: 'Unwanted traffic filtered',
        base: 18400,
        filtered: [180, 320],
        status: 'Every public event and ticket page is up. HTTPS is valid (renews in 76 days). No defacement or unexpected page changes.',
        checks: [
            '19 event and ticket pages online · 100% uptime today',
            'HTTPS valid on every public page',
            'Bot and scalper-like traffic filtered before it reaches buyers',
            'Automated traffic filtered before it reaches checkout',
            'No defacement or unexpected edits to your pages',
        ],
        meaning: 'Buyers can reach your events over a secure connection, and automated or scalper-like traffic is filtered before it becomes a problem for them — or for you.',
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
            'Failed sign-ins are stopped automatically',
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
            'Fraud screening on every checkout',
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
        { minutes: 7, source: 'account', tone: 'protected', text: 'Stopped 3 failed sign-ins from an unrecognized location — none were your team' },
        { minutes: 9, source: 'doors', tone: 'protected', text: 'A duplicate ticket was stopped at Battery Club Door 2' },
        { minutes: 11, source: 'checkout', tone: 'ok', text: 'Kitchen Party order NL-003893 passed fraud screening' },
        { minutes: 15, source: 'account', tone: 'ok', text: 'Hana Sato signed in from her usual device' },
        { minutes: 19, source: 'doors', tone: 'ok', text: 'Kitchen Party walk-up sales synced from Box Office Tablet 1' },
        { minutes: 26, source: 'website', tone: 'protected', text: 'Filtered scalper-like traffic on the Harbour Lights Festival ticket page' },
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

    return {
        status: 'healthy',
        scannedAt: scanAt,
        nextScanAt: new Date(scanAt.getTime() + SCAN_INTERVAL_MINUTES * MINUTE),
        windowLabel: 'Last 24 hours',
        meaning: 'Nothing here needs urgent attention. Your event pages are up and locked with HTTPS, your team is signed in safely, checkout is being screened, and tonight\'s door devices are ready. Two teammates are recommended to choose a stronger password, and three invites will set up 2FA when they join.',
        sources,
        devices: DOOR_DEVICES,
        team,
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
