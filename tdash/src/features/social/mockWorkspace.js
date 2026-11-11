/** Phase 1 mock workspace. Swap this module for the API in phase 2. */

export const SOCIAL_NOW = '2027-07-10T18:30:00.000Z';

const DEFAULT_PHRASES = {
    Ticketing: ['ticket', 'qr', 'transfer', 'resale', 'sold out', 'presale code'],
    Refunds: ['refund', 'chargeback', 'money back', 'cancelled'],
    'Access/Entry': ['line', 'queue', 'entry', 'wristband', 'doors', 'bag policy'],
    Lineup: ['set time', 'cancelled set', 'headliner', 'clash'],
    Safety: ['injured', 'medical', 'crush', 'unsafe', 'harass', 'lost child'],
};

export const cloneDefaultPhrases = () => ({
    Ticketing: [...DEFAULT_PHRASES.Ticketing],
    Refunds: [...DEFAULT_PHRASES.Refunds],
    'Access/Entry': [...DEFAULT_PHRASES['Access/Entry']],
    Lineup: [...DEFAULT_PHRASES.Lineup],
    Safety: [...DEFAULT_PHRASES.Safety],
});

const ready = () => ({
    scene: 'ready',
    now: SOCIAL_NOW,
    mode: 'EVENT_DAY',
    modeLabel: 'EVENT DAY',
    modeEventName: 'Harbourfest 2027',
    unansweredLabel: 'Unanswered > 30 min',
    scheduleNote: '',
    onSaleNote: '',
    accounts: [
        { id: 'fb-page', platform: 'Facebook', name: 'Harbourfest', status: 'CONNECTED', lastSync: '2027-07-10T18:29:00.000Z' },
        { id: 'ig-pro', platform: 'Instagram', name: 'harbourfest', status: 'CONNECTED', lastSync: '2027-07-10T18:29:00.000Z' },
    ],
    events: [
        { id: 'harbourfest-2027', name: 'Harbourfest 2027', mode: 'EVENT_DAY', modeLabel: 'EVENT DAY', onSale: true, scheduled: true },
        { id: 'quiet-hall', name: 'Quiet Hall', mode: 'NORMAL', modeLabel: 'NORMAL', onSale: false, scheduled: true },
        { id: 'undated', name: 'Workshop Hold', mode: 'NORMAL', modeLabel: 'NORMAL', onSale: false, scheduled: false },
    ],
    kpis: {
        reach: '22.6k',
        engagements: '1,840',
        followers: '48.2k',
        openIssues: '3',
        unanswered: '1',
        detail: '+12% vs prev',
    },
    trend: [
        { day: 'Jul 1', facebook: 40, instagram: 28, marker: 'On-sale' },
        { day: 'Jul 8', facebook: 52, instagram: 33, marker: '' },
        { day: 'Jul 10', facebook: 90, instagram: 70, marker: 'Event day' },
    ],
    topics: [
        { topic: 'Safety', count: 1 },
        { topic: 'Ticketing', count: 1 },
        { topic: 'Lineup', count: 1 },
    ],
    posts: [
        {
            id: 'post-fb-1',
            platform: 'Facebook',
            account: 'facebook',
            postedAt: '2027-07-10T16:00:00.000Z',
            reach: '12,840',
            engagementRate: '4.2%',
            engagements: '540',
            comments: 18,
            openIssues: 2,
            views: '9,100',
            saves: '—',
            shares: '86',
            permalink: 'https://example.test/sandbox/facebook/post-fb-1',
            insights: 'ready',
        },
        {
            id: 'post-ig-1',
            platform: 'Instagram',
            account: 'instagram',
            postedAt: '2027-07-10T17:00:00.000Z',
            reach: '9,800',
            engagementRate: '6.1%',
            engagements: '600',
            comments: 11,
            openIssues: 1,
            views: '8,400',
            saves: '120',
            shares: '40',
            permalink: 'https://example.test/sandbox/instagram/post-ig-1',
            insights: 'ready',
        },
    ],
    comments: [
        { id: 'c-safety', postId: 'post-fb-1', handle: '@harbourfan', text: 'someone was injured near the gate', label: '', topic: 'Safety', at: '2027-07-10T18:10:00.000Z', unanswered: false },
        { id: 'c-ticket', postId: 'post-fb-1', handle: '@qrhelp', text: 'where is my ticket?', label: '', topic: 'Ticketing', at: '2027-07-10T18:12:00.000Z', unanswered: false },
        { id: 'c-lineup', postId: 'post-ig-1', handle: '@settimes', text: 'what is the set time?', label: '', topic: 'Lineup', at: '2027-07-10T17:40:00.000Z', unanswered: true },
    ],
    issues: [
        {
            id: 'single-safety-c-safety',
            kind: 'SINGLE',
            topic: 'Safety',
            severity: 'HIGH',
            state: 'NEW',
            ruleText: 'Safety keyword on one comment. Matched: "injured". Mode EVENT DAY.',
            commentIds: ['c-safety'],
            assignee: '',
            unanswered: false,
            activity: [{ at: '2027-07-10T18:10:00.000Z', text: 'Opened by rule Safety keyword. Matched: "injured".' }],
        },
        {
            id: 'wave-ticketing',
            kind: 'WAVE',
            topic: 'Ticketing',
            severity: 'HIGH',
            state: 'NEW',
            ruleText: 'Ticketing spike: 12 comments in this 15-minute bucket vs baseline 8/h (b=2, 1.5×, min 3, mode EVENT DAY). Matched: "ticket".',
            commentIds: ['c-ticket'],
            count: 12,
            assignee: '',
            unanswered: false,
            activity: [{ at: '2027-07-10T18:12:00.000Z', text: 'Opened by rule Ticketing spike (12 vs baseline 8/h, mode EVENT DAY).' }],
        },
        {
            id: 'single-unanswered-c-lineup',
            kind: 'SINGLE',
            topic: 'Lineup',
            severity: 'LOW',
            state: 'NEW',
            ruleText: 'Unanswered question for 0.8h (limit 30 min, mode EVENT DAY).',
            commentIds: ['c-lineup'],
            assignee: '',
            unanswered: true,
            activity: [{ at: '2027-07-10T18:20:00.000Z', text: 'Opened by rule unanswered past 30 min.' }],
        },
    ],
    banners: [],
    permissionNote: '',
    rateLimit: '',
    phrases: cloneDefaultPhrases(),
});

const withNeeds = (workspace) => ({
    ...workspace,
    needsAction: workspace.issues.filter((issue) => issue.state === 'NEW' || issue.state === 'IN_PROGRESS').length,
});

export const buildWorkspace = (scene = 'ready') => {
    const workspace = ready();
    if (scene === 'no-accounts') {
        return withNeeds({ ...workspace, scene, accounts: [], posts: [], comments: [], issues: [], kpis: { ...workspace.kpis, reach: '—', engagements: '—', followers: '—', openIssues: '0', unanswered: '0' } });
    }
    if (scene === 'syncing') {
        return withNeeds({
            ...workspace,
            scene,
            kpis: { reach: '—', engagements: '—', followers: '—', openIssues: '—', unanswered: '—', detail: 'Syncing' },
        });
    }
    if (scene === 'no-data') {
        return withNeeds({ ...workspace, scene, posts: [], comments: [], issues: [], topics: [] });
    }
    if (scene === 'insights-pending') {
        return withNeeds({
            ...workspace,
            scene,
            kpis: { reach: 'Pending', engagements: 'Pending', followers: '48.2k', openIssues: '3', unanswered: '1', detail: 'Insights pending' },
            posts: workspace.posts.map((post) => ({ ...post, reach: 'Pending', engagements: 'Pending', views: 'Pending', saves: 'Pending', shares: 'Pending', insights: 'pending' })),
        });
    }
    if (scene === 'token-expired') {
        return withNeeds({
            ...workspace,
            scene,
            accounts: workspace.accounts.map((account) => ({ ...account, status: 'NEEDS_ATTENTION' })),
            banners: ['Sandbox token expired.'],
        });
    }
    if (scene === 'missing-permission') {
        return withNeeds({
            ...workspace,
            scene,
            permissionNote: 'This panel needs the insights permission on the sandbox account. Reconnect in Settings to grant it.',
            kpis: { ...workspace.kpis, reach: 'Pending', engagements: 'Pending', detail: 'Missing permission' },
        });
    }
    if (scene === 'rate-limited') {
        return withNeeds({ ...workspace, scene, rateLimit: 'Rate limited. Retry at 16:05 NDT.' });
    }
    if (scene === 'no-issues') {
        return withNeeds({ ...workspace, scene, issues: [], topics: [], kpis: { ...workspace.kpis, openIssues: '0', unanswered: '0' } });
    }
    if (scene === 'no-schedule') {
        return withNeeds({
            ...workspace,
            scene,
            mode: 'NORMAL',
            modeLabel: 'NORMAL',
            modeEventName: 'Workshop Hold',
            unansweredLabel: 'Unanswered > 4h',
            scheduleNote: 'No schedule dates. Alerts stay NORMAL.',
            onSaleNote: 'No on-sale date. ON-SALE DAY does not trigger.',
        });
    }
    return withNeeds({ ...workspace, scene });
};
