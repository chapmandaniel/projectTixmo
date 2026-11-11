/** Phase 1 mock workspace. Swap this module for the API in phase 2. */

export const SOCIAL_NOW = '2027-07-10T18:30:00.000Z';

const DEFAULT_PHRASES = {
    Ticketing: ['ticket', 'qr', 'transfer', 'resale', 'sold out', 'presale code'],
    Refunds: ['refund', 'chargeback', 'money back', 'cancelled'],
    'Access/Entry': ['line', 'queue', 'entry', 'wristband', 'doors', 'bag policy'],
    Lineup: ['set time', 'cancelled set', 'headliner', 'clash'],
    Safety: ['injured', 'medical', 'crush', 'unsafe', 'harass', 'lost child'],
};

export const DEFAULT_THRESHOLDS = {
    NORMAL: { multiplier: '3.0×', minimum: '10 / h', unanswered: '4 h' },
    ON_SALE_DAY: { multiplier: '2.0×', minimum: '5 / h', unanswered: '1 h' },
    EVENT_DAY: { multiplier: '1.5×', minimum: '3 / 15m', unanswered: '30 min' },
};

export const cloneDefaultPhrases = () => ({
    Ticketing: [...DEFAULT_PHRASES.Ticketing],
    Refunds: [...DEFAULT_PHRASES.Refunds],
    'Access/Entry': [...DEFAULT_PHRASES['Access/Entry']],
    Lineup: [...DEFAULT_PHRASES.Lineup],
    Safety: [...DEFAULT_PHRASES.Safety],
});

export const cloneDefaultThresholds = () => ({
    NORMAL: { ...DEFAULT_THRESHOLDS.NORMAL },
    ON_SALE_DAY: { ...DEFAULT_THRESHOLDS.ON_SALE_DAY },
    EVENT_DAY: { ...DEFAULT_THRESHOLDS.EVENT_DAY },
});

const ready = () => ({
    scene: 'ready',
    now: SOCIAL_NOW,
    mode: 'EVENT_DAY',
    modeLabel: 'EVENT DAY',
    modeSource: 'auto',
    modeEventName: 'Harbourfest 2027',
    unansweredLabel: 'Unanswered > 30 min',
    unansweredLimit: '30 min',
    oldestUnanswered: '50 min',
    syncedLabel: 'Synced 1 min ago',
    scheduleNote: '',
    onSaleNote: '',
    datesUsed: 'On-sale Nov 1 · Event Jul 10–12 (event timezone) · today = Jul 10',
    hold: null,
    modeLog: ['Mode is automatic from event dates.'],
    accounts: [
        {
            id: 'fb-page',
            platform: 'Facebook',
            platformLabel: 'Facebook Page (sandbox)',
            name: 'Harbourfest Test',
            status: 'CONNECTED',
            lastSync: '2027-07-10T18:29:00.000Z',
            attention: '',
        },
        {
            id: 'ig-pro',
            platform: 'Instagram',
            platformLabel: 'Instagram (sandbox)',
            name: 'harbourfest_sbx',
            status: 'CONNECTED',
            lastSync: '2027-07-10T18:29:00.000Z',
            attention: '',
        },
    ],
    events: [
        { id: 'harbourfest-2027', name: 'Harbourfest 2027', mode: 'EVENT_DAY', modeLabel: 'EVENT DAY', onSale: true, scheduled: true },
        { id: 'harbourfest-2026', name: 'Harbourfest 2026', mode: 'NORMAL', modeLabel: 'NORMAL', onSale: true, scheduled: true },
        { id: 'quiet-hall', name: 'Quiet Hall', mode: 'NORMAL', modeLabel: 'NORMAL', onSale: false, scheduled: true },
        { id: 'undated', name: 'Workshop Hold', mode: 'NORMAL', modeLabel: 'NORMAL', onSale: false, scheduled: false },
    ],
    sandboxPages: [
        {
            id: 'harbourfest-test',
            platformLabel: 'Facebook Page (sandbox)',
            name: 'Harbourfest Test',
            linked: 'Instagram (sandbox) harbourfest_sbx',
        },
        {
            id: 'merch-test',
            platformLabel: 'Facebook Page (sandbox)',
            name: 'Merch Test',
            linked: 'none',
        },
    ],
    kpis: {
        reach: '48,200',
        engagements: '3,910',
        followers: '21,480',
        openIssues: '4',
        unanswered: '2',
        reachDetail: '+12% vs prev',
        engagementDetail: '−4% vs prev',
        followerDetail: '+310 net',
        openDetail: '2 NEW',
        unansweredDetail: 'limit 30 min, EVENT DAY',
    },
    trend: [
        { day: 'Jul 1', facebook: 40, instagram: 28, marker: 'ON-SALE' },
        { day: 'Jul 8', facebook: 52, instagram: 33, marker: '' },
        { day: 'Jul 10', facebook: 90, instagram: 70, marker: 'DAY 1' },
    ],
    waves: [
        { topic: 'Ticketing', count: '12', status: 'HIGH open' },
        { topic: 'Access/Entry', count: '6', status: 'below limit' },
        { topic: 'Lineup', count: '1', status: 'below limit' },
    ],
    topics: [
        { topic: 'Ticketing', count: 1 },
        { topic: 'Refunds', count: 1 },
        { topic: 'Lineup', count: 2 },
        { topic: 'Safety', count: 1 },
        { topic: 'Other', count: 1 },
    ],
    posts: [
        {
            id: 'post-fb-1',
            platform: 'Facebook',
            account: 'facebook',
            caption: 'Lineup drop: Friday artists',
            postedAt: '2027-07-10T16:00:00.000Z',
            reach: '12.1k',
            engagementRate: '5.1%',
            engagements: '540',
            comments: 146,
            flagged: 2,
            openIssues: 2,
            views: '9,100',
            saves: '—',
            shares: '86',
            permalink: 'https://example.test/sandbox/facebook/post-fb-1',
            insights: 'ready',
            hourly: '2 · 4 · 7 · 11',
        },
        {
            id: 'post-ig-1',
            platform: 'Instagram',
            account: 'instagram',
            caption: 'Doors at 4pm',
            postedAt: '2027-07-10T17:00:00.000Z',
            reach: '9.8k',
            engagementRate: '3.9%',
            engagements: '382',
            comments: 88,
            flagged: 2,
            openIssues: 2,
            views: '14.2k',
            saves: '120',
            shares: '41',
            permalink: 'https://example.test/sandbox/instagram/post-ig-1',
            insights: 'ready',
            hourly: '1 · 3 · 6 · 4',
        },
        {
            id: 'post-fb-2',
            platform: 'Facebook',
            account: 'facebook',
            caption: 'Day 2 update',
            postedAt: '2027-07-10T18:00:00.000Z',
            reach: '—',
            engagementRate: '—',
            engagements: '—',
            comments: 31,
            flagged: 1,
            openIssues: 1,
            views: '—',
            saves: '—',
            shares: '—',
            permalink: 'https://example.test/sandbox/facebook/post-fb-2',
            insights: 'pending',
            hourly: '—',
        },
    ],
    comments: [
        { id: 'c-safety', postId: 'post-fb-1', handle: '@harbourfan', text: 'someone was injured near the gate', label: '', topic: 'Safety', at: '2027-07-10T18:10:00.000Z', unanswered: false, flagged: true, pageReplyAt: '' },
        { id: 'c-ticket', postId: 'post-fb-1', handle: '@qrhelp', text: 'where is my ticket?', label: '', topic: 'Ticketing', at: '2027-07-10T18:12:00.000Z', unanswered: false, flagged: true, pageReplyAt: '' },
        { id: 'c-ticket-2', postId: 'post-fb-1', handle: '@gatefan', text: 'ticket will not scan at the door', label: '', topic: 'Ticketing', at: '2027-07-10T18:14:00.000Z', unanswered: false, flagged: true, pageReplyAt: '' },
        { id: 'c-ticket-3', postId: 'post-ig-1', handle: '@transfer', text: 'can I transfer this ticket?', label: '', topic: 'Ticketing', at: '2027-07-10T18:16:00.000Z', unanswered: true, flagged: true, pageReplyAt: '' },
        { id: 'c-refund', postId: 'post-fb-2', handle: '@daytwo', text: 'still waiting to hear about the cancelled day', label: '', topic: 'Refunds', at: '2027-07-10T16:00:00.000Z', unanswered: true, flagged: true, pageReplyAt: '' },
        { id: 'c-lineup', postId: 'post-ig-1', handle: '@settimes', text: 'what is the set time?', label: '', topic: 'Lineup', at: '2027-07-10T17:40:00.000Z', unanswered: true, flagged: true, pageReplyAt: '' },
        { id: 'c-cheer', postId: 'post-ig-1', handle: '@neighbour', text: 'see you there!!', label: '', topic: '', at: '2027-07-10T17:02:00.000Z', unanswered: false, flagged: false, pageReplyAt: '2027-07-10T17:10:00.000Z' },
        { id: 'c-handled', postId: 'post-ig-1', handle: '@alexfan', text: 'is the headliner still playing?', label: '', topic: 'Lineup', at: '2027-07-10T13:00:00.000Z', unanswered: false, flagged: true, pageReplyAt: '' },
        { id: 'c-dismissed', postId: 'post-fb-1', handle: '@spamfan', text: 'nice poster', label: '', topic: 'Other', at: '2027-07-10T12:00:00.000Z', unanswered: false, flagged: true, pageReplyAt: '' },
    ],
    issues: [
        {
            id: 'single-safety-c-safety',
            kind: 'SINGLE',
            topic: 'Safety',
            severity: 'HIGH',
            state: 'NEW',
            ruleText: 'Safety keyword on one comment. Matched: "injured". Mode EVENT DAY.',
            matched: 'injured',
            commentIds: ['c-safety'],
            count: 1,
            assignee: '',
            unanswered: false,
            openedAt: '2027-07-10T18:10:00.000Z',
            topTerms: 'injured 1',
            volume: '1',
            baseline: '1',
            activity: [
                { at: '2027-07-10T18:10:00.000Z', text: 'Opened by rule Safety keyword (1 comment, mode EVENT DAY). Matched: "injured".' },
            ],
        },
        {
            id: 'wave-ticketing',
            kind: 'WAVE',
            topic: 'Ticketing',
            severity: 'HIGH',
            state: 'NEW',
            ruleText: 'Ticketing spike: 12 comments in this 15-minute bucket vs baseline 2/h (1.5×, min 3, mode EVENT DAY). Matched: "ticket".',
            matched: 'ticket',
            commentIds: ['c-ticket', 'c-ticket-2', 'c-ticket-3'],
            count: 12,
            assignee: '',
            unanswered: false,
            openedAt: '2027-07-10T18:12:00.000Z',
            topTerms: '"ticket" 8 · "qr" 3',
            volume: '0 · 1 · 3 · 8 · 12',
            baseline: '2/h',
            activity: [
                { at: '2027-07-10T18:12:00.000Z', text: 'Opened by rule Ticketing spike (12/h vs baseline 2/h, mode EVENT DAY).' },
                { at: '2027-07-10T18:13:00.000Z', text: 'Alert sent: in-app badge; email to org admins.' },
            ],
        },
        {
            id: 'single-refunds',
            kind: 'SINGLE',
            topic: 'Refunds',
            severity: 'MED',
            state: 'IN_PROGRESS',
            ruleText: 'Refunds keyword plus a question, no Page reply. Matched: "cancelled". Mode EVENT DAY.',
            matched: 'cancelled',
            commentIds: ['c-refund'],
            count: 1,
            assignee: 'Sam R.',
            unanswered: true,
            openedAt: '2027-07-10T16:10:00.000Z',
            topTerms: 'cancelled 1',
            volume: '1',
            baseline: '1',
            activity: [
                { at: '2027-07-10T16:10:00.000Z', text: 'Opened by rule Refunds keyword (1 comment, question, mode EVENT DAY). Matched: "cancelled".' },
                { at: '2027-07-10T16:20:00.000Z', text: 'Assigned to Sam R. by Avery Stone.' },
                { at: '2027-07-10T16:21:00.000Z', text: 'Alert sent: in-app badge; email to Sam R.' },
            ],
        },
        {
            id: 'single-unanswered-c-lineup',
            kind: 'SINGLE',
            topic: 'Lineup',
            severity: 'LOW',
            state: 'NEW',
            ruleText: 'Unanswered question for 50 min (limit 30 min, mode EVENT DAY).',
            matched: 'set time',
            commentIds: ['c-lineup'],
            count: 1,
            assignee: '',
            unanswered: true,
            openedAt: '2027-07-10T18:20:00.000Z',
            topTerms: 'set time 1',
            volume: '1',
            baseline: '1',
            activity: [
                { at: '2027-07-10T18:20:00.000Z', text: 'Opened by rule unanswered past 30 min (age 50 min, mode EVENT DAY).' },
            ],
        },
        {
            id: 'single-handled',
            kind: 'SINGLE',
            topic: 'Lineup',
            severity: 'LOW',
            state: 'HANDLED',
            ruleText: 'Manual flag by Alex P. Topic Lineup, severity LOW.',
            matched: 'headliner',
            commentIds: ['c-handled'],
            count: 1,
            assignee: 'Alex P.',
            unanswered: false,
            openedAt: '2027-07-10T13:05:00.000Z',
            topTerms: 'headliner 1',
            volume: '1',
            baseline: '1',
            activity: [
                { at: '2027-07-10T13:05:00.000Z', text: 'Opened by manual flag by Alex P. (topic Lineup, severity LOW, mode EVENT DAY).' },
                { at: '2027-07-10T13:06:00.000Z', text: 'Assigned to Alex P. by Avery Stone.' },
                { at: '2027-07-10T14:00:00.000Z', text: 'Marked handled by Alex P.' },
            ],
        },
        {
            id: 'single-dismissed',
            kind: 'SINGLE',
            topic: 'Other',
            severity: 'LOW',
            state: 'DISMISSED',
            ruleText: 'Manual flag. Dismissed: Not an issue.',
            matched: '',
            commentIds: ['c-dismissed'],
            count: 1,
            assignee: '',
            unanswered: false,
            openedAt: '2027-07-10T12:05:00.000Z',
            topTerms: '',
            volume: '1',
            baseline: '1',
            activity: [
                { at: '2027-07-10T12:05:00.000Z', text: 'Opened by manual flag by Avery Stone (topic Other, severity LOW, mode EVENT DAY).' },
                { at: '2027-07-10T12:12:00.000Z', text: 'Dismissed: Not an issue. By Avery Stone.' },
            ],
        },
    ],
    banners: [],
    permissionNote: '',
    rateLimit: '',
    syncProgress: '',
    phrases: cloneDefaultPhrases(),
});

const withNeeds = (workspace) => ({
    ...workspace,
    needsAction: workspace.issues.filter((issue) => issue.state === 'NEW' || issue.state === 'IN_PROGRESS').length,
});

export const buildWorkspace = (scene = 'ready') => {
    const workspace = ready();
    if (scene === 'no-accounts') {
        return withNeeds({
            ...workspace,
            scene,
            mode: 'NORMAL',
            modeLabel: 'NORMAL',
            modeSource: 'auto',
            modeEventName: '',
            unansweredLabel: 'Unanswered > 4h',
            unansweredLimit: '4 h',
            accounts: [],
            posts: [],
            comments: [],
            issues: [],
            waves: [],
            topics: [],
            kpis: { ...workspace.kpis, reach: '—', engagements: '—', followers: '—', openIssues: '0', unanswered: '0' },
            syncedLabel: '',
        });
    }
    if (scene === 'syncing') {
        return withNeeds({
            ...workspace,
            scene,
            issues: [],
            posts: [],
            comments: [],
            kpis: {
                reach: '—',
                engagements: '—',
                followers: '—',
                openIssues: '—',
                unanswered: '—',
                reachDetail: 'Syncing',
                engagementDetail: 'Syncing',
                followerDetail: 'Syncing',
                openDetail: 'Syncing',
                unansweredDetail: 'Syncing',
            },
            syncProgress: 'Syncing sandbox test data… Posts ✓  Comments …  Insights …',
            syncedLabel: '',
            trend: [],
            waves: [],
            topics: [],
        });
    }
    if (scene === 'no-data') {
        return withNeeds({ ...workspace, scene, posts: [], comments: [], issues: [], topics: [], waves: [] });
    }
    if (scene === 'insights-pending') {
        return withNeeds({
            ...workspace,
            scene,
            kpis: { ...workspace.kpis, reach: 'Pending', engagements: 'Pending', reachDetail: 'Insights pending', engagementDetail: 'Insights pending' },
            posts: workspace.posts.map((post) => ({
                ...post,
                reach: '—',
                engagements: '—',
                engagementRate: '—',
                views: '—',
                saves: '—',
                shares: '—',
                insights: 'pending',
            })),
        });
    }
    if (scene === 'token-expired') {
        return withNeeds({
            ...workspace,
            scene,
            accounts: workspace.accounts.map((account) => account.id === 'ig-pro'
                ? { ...account, status: 'NEEDS ATTENTION', lastSync: '2027-07-08T18:30:00.000Z', attention: 'sandbox token expired' }
                : account),
            banners: ['NEEDS ATTENTION (Sandbox): Instagram (sandbox) harbourfest_sbx stopped syncing 2 days ago: sandbox token expired. Data below may be out of date.'],
        });
    }
    if (scene === 'missing-permission') {
        return withNeeds({
            ...workspace,
            scene,
            permissionNote: 'Insights unavailable: this sandbox connection has no insights access.',
            kpis: { ...workspace.kpis, reach: 'Pending', engagements: 'Pending', reachDetail: 'Missing permission', engagementDetail: 'Missing permission' },
        });
    }
    if (scene === 'rate-limited') {
        return withNeeds({ ...workspace, scene, rateLimit: 'Sync paused: the sandbox is limiting requests. Retrying at 4:30 PM NDT.' });
    }
    if (scene === 'no-issues') {
        return withNeeds({ ...workspace, scene, issues: [], topics: [], waves: [], kpis: { ...workspace.kpis, openIssues: '0', unanswered: '0', openDetail: '0 NEW', unansweredDetail: 'limit 30 min, EVENT DAY' } });
    }
    if (scene === 'no-schedule') {
        return withNeeds({
            ...workspace,
            scene,
            mode: 'NORMAL',
            modeLabel: 'NORMAL',
            modeEventName: 'Workshop Hold',
            unansweredLabel: 'Unanswered > 4h',
            unansweredLimit: '4 h',
            scheduleNote: 'No schedule dates. Alerts stay in NORMAL mode.',
            onSaleNote: 'No on-sale date set for this event. ON-SALE DAY does not trigger.',
            datesUsed: 'No dates set for this event.',
            events: [
                { id: 'undated', name: 'Workshop Hold', mode: 'NORMAL', modeLabel: 'NORMAL', onSale: false, scheduled: false },
                { id: 'quiet-hall', name: 'Quiet Hall', mode: 'NORMAL', modeLabel: 'NORMAL', onSale: false, scheduled: true },
            ],
        });
    }
    if (scene === 'on-sale') {
        return withNeeds({
            ...workspace,
            scene,
            mode: 'ON_SALE_DAY',
            modeLabel: 'ON-SALE DAY',
            unansweredLabel: 'Unanswered > 1h',
            unansweredLimit: '1 h',
            kpis: { ...workspace.kpis, unansweredDetail: 'limit 1 h, ON-SALE DAY' },
            datesUsed: 'On-sale Jul 10 · Event Jul 18–19 (event timezone) · today = Jul 10',
        });
    }
    if (scene === 'hold') {
        return withNeeds({
            ...workspace,
            scene,
            mode: 'EVENT_DAY',
            modeLabel: 'EVENT DAY',
            modeSource: 'held',
            hold: { mode: 'EVENT_DAY', until: '2027-07-11' },
            modeLog: [
                'Jul 10, 9:00 AM NDT  Hold EVENT DAY set until Jul 11, 2027 by Avery Stone.',
                'Hold ends Jul 11, 2027. The mode then returns to automatic.',
            ],
        });
    }
    if (scene === 'hold-expired') {
        return withNeeds({
            ...workspace,
            scene,
            mode: 'NORMAL',
            modeLabel: 'NORMAL',
            modeSource: 'auto',
            unansweredLabel: 'Unanswered > 4h',
            unansweredLimit: '4 h',
            kpis: { ...workspace.kpis, unansweredDetail: 'limit 4 h, NORMAL' },
            modeLog: ['Jul 9, 9:00 AM NDT  Hold expired. Mode returned to automatic.'],
        });
    }
    if (scene === 'reply-detected') {
        return withNeeds({
            ...workspace,
            scene,
            comments: workspace.comments.map((comment) => comment.id === 'c-lineup'
                ? { ...comment, unanswered: false, pageReplyAt: '2027-07-10T18:28:00.000Z' }
                : comment),
            issues: workspace.issues.map((issue) => issue.id === 'single-unanswered-c-lineup'
                ? {
                    ...issue,
                    unanswered: false,
                    activity: [
                        ...issue.activity,
                        { at: '2027-07-10T18:28:00.000Z', text: 'Reply detected on Meta (Page) on 1 comment. Item left the unanswered queue.' },
                    ],
                }
                : issue),
            kpis: { ...workspace.kpis, unanswered: '1' },
            oldestUnanswered: '2.5h',
        });
    }
    return withNeeds({ ...workspace, scene });
};
