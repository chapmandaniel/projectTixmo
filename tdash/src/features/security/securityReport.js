// Labs demo: the security report is generated on the client from a fixed daily seed so it
// always looks current ("last scanned N min ago") and stays the same across reloads.
import { Activity, CreditCard, KeyRound, ScanLine, Server, UserCog } from 'lucide-react';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

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

// Scans run every 5 minutes and finish ~1 minute after they start.
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

const SOURCE_DEFS = [
    {
        id: 'auth',
        name: 'Sign-ins & accounts',
        icon: KeyRound,
        base: 18400,
        blocked: [3, 9],
        blockedLabel: 'suspicious sign-ins blocked',
        status: 'No account takeovers. Failed sign-ins are within the normal range.',
        checks: ['Rate limiting on every sign-in', 'Sessions expire after 30 min idle'],
    },
    {
        id: 'api',
        name: 'API traffic',
        icon: Activity,
        base: 612000,
        blocked: [6, 19],
        blockedLabel: 'malformed or abusive requests rejected',
        status: 'Error rate 0.02%. All requests authenticated and rate limited.',
        checks: ['TLS on every connection', 'Per-route rate limits active'],
    },
    {
        id: 'payments',
        name: 'Payments & webhooks',
        icon: CreditCard,
        base: 9200,
        blocked: [0, 2],
        blockedLabel: 'unsigned webhooks rejected',
        status: 'Every payment webhook signature verified. No chargeback spikes.',
        checks: ['Card data handled by Stripe, never stored', 'Webhook signatures verified'],
    },
    {
        id: 'admin',
        name: 'Admin & staff actions',
        icon: UserCog,
        base: 1460,
        blocked: [0, 1],
        blockedLabel: 'unauthorized actions denied',
        status: 'All role changes and refunds made by authorized staff.',
        checks: ['Role-based access on every action', 'Owner-only team changes'],
    },
    {
        id: 'door',
        name: 'Door scanning',
        icon: ScanLine,
        base: 7400,
        blocked: [2, 7],
        blockedLabel: 'duplicate or invalid tickets stopped',
        status: 'Scanners online. Duplicate entries were caught at the door.',
        checks: ['Each ticket admits once', 'Lost scanners can be revoked instantly'],
    },
    {
        id: 'infra',
        name: 'Infrastructure',
        icon: Server,
        base: 241000,
        blocked: [0, 3],
        blockedLabel: 'port scans dropped',
        status: 'Uptime 99.99%. Database backups verified today.',
        checks: ['Daily backups verified', 'Private network between services'],
    },
];

const between = (rand, [lo, hi]) => lo + Math.floor(rand() * (hi - lo + 1));

export const buildSecurityReport = (now = Date.now()) => {
    const rand = prng(daySeed(now));
    // Share of the day elapsed keeps counts growing through the day instead of jumping.
    const hourOfDay = new Date(now).getHours() + new Date(now).getMinutes() / 60;
    const dayShare = 0.55 + 0.45 * (hourOfDay / 24);

    const sources = SOURCE_DEFS.map((def) => {
        const events = Math.round(def.base * (0.9 + rand() * 0.2) * (1 + dayShare));
        const blocked = between(rand, def.blocked);
        const trend = Array.from({ length: 14 }, () => Math.round(def.base * (0.75 + rand() * 0.5)));
        return {
            ...def,
            health: 'healthy',
            events,
            blocked,
            trend,
            uptime: def.id === 'infra' ? '99.99%' : '100%',
        };
    });

    const totals = sources.reduce((acc, s) => ({
        events: acc.events + s.events,
        blocked: acc.blocked + s.blocked,
    }), { events: 0, blocked: 0 });

    const scanAt = lastScanAt(now);
    const feed = [
        { minutes: 2, source: 'infra', tone: 'ok', text: 'Scheduled log scan finished: 6 of 6 sources healthy' },
        { minutes: 7, source: 'auth', tone: 'blocked', text: 'Blocked 3 failed sign-ins from an unrecognized IP (rate limit)' },
        { minutes: 11, source: 'payments', tone: 'ok', text: 'Payment webhook signature verified for order NL-002291' },
        { minutes: 18, source: 'door', tone: 'blocked', text: 'Duplicate ticket scan stopped at Main Gate A' },
        { minutes: 26, source: 'api', tone: 'blocked', text: 'Rejected 14 malformed requests to the public events API' },
        { minutes: 34, source: 'admin', tone: 'ok', text: 'Priya Raman changed Marcus Bell to Team Member (authorized)' },
        { minutes: 52, source: 'auth', tone: 'ok', text: 'New device sign-in confirmed for Jordan Okafor' },
        { minutes: 71, source: 'infra', tone: 'ok', text: 'TLS certificates valid for all domains (renews in 76 days)' },
        { minutes: 95, source: 'payments', tone: 'ok', text: 'Refund for order NL-001874 matched its payment' },
        { minutes: 128, source: 'door', tone: 'ok', text: 'Scanner "VIP Lane" checked in and synced' },
        { minutes: 186, source: 'infra', tone: 'ok', text: 'Nightly database backup verified and restorable' },
        { minutes: 244, source: 'api', tone: 'ok', text: 'Traffic spike from Harbour Lights on-sale handled with no errors' },
    ].map((item, index) => ({
        id: `feed-${index}`,
        ...item,
        at: new Date(scanAt.getTime() - (item.minutes - 2) * MINUTE),
        sourceName: SOURCE_DEFS.find((s) => s.id === item.source)?.name,
    }));

    return {
        status: 'healthy',
        scannedAt: scanAt,
        nextScanAt: new Date(scanAt.getTime() + SCAN_INTERVAL_MINUTES * MINUTE),
        windowLabel: 'Last 24 hours',
        sources,
        totals: {
            ...totals,
            sources: sources.length,
            healthySources: sources.filter((s) => s.health === 'healthy').length,
            openIncidents: 0,
            detectSeconds: 42,
        },
        feed,
    };
};
