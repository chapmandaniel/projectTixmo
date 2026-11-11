export const SOCIAL_TABS = ['overview', 'issues', 'posts', 'settings'];
export const SOCIAL_RANGES = ['today', '7d', '28d', '30d', 'custom'];
export const SOCIAL_ACCOUNTS = ['all', 'facebook', 'instagram'];
export const ISSUE_VIEWS = ['needs-action', 'unanswered', 'waves', 'handled', 'all'];
export const ISSUE_STATUSES = ['all', 'NEW', 'IN_PROGRESS', 'HANDLED', 'DISMISSED'];
export const ISSUE_TOPICS = ['all', 'Ticketing', 'Refunds', 'Access/Entry', 'Lineup', 'Safety', 'Other'];
export const ISSUE_SEVERITIES = ['all', 'HIGH', 'MED', 'LOW'];

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

export const readSocialFilters = (params) => ({
    tab: oneOf(params.get('tab'), SOCIAL_TABS, 'overview'),
    event: params.get('event') || 'all',
    range: oneOf(params.get('range'), SOCIAL_RANGES, '7d'),
    from: params.get('from') || '',
    to: params.get('to') || '',
    account: oneOf(params.get('account'), SOCIAL_ACCOUNTS, 'all'),
    scene: params.get('scene') || 'ready',
    graphError: params.get('graphError') || '',
    connect: params.get('connect') || '',
    view: oneOf(params.get('view'), ISSUE_VIEWS, 'needs-action'),
    status: oneOf(params.get('status'), ISSUE_STATUSES, 'all'),
    topic: oneOf(params.get('topic'), ISSUE_TOPICS, 'all'),
    severity: oneOf(params.get('severity'), ISSUE_SEVERITIES, 'all'),
    assignee: params.get('assignee') || 'all',
    comments: oneOf(params.get('comments'), ['all', 'flagged', 'unanswered'], 'all'),
});

export const writeSocialSearch = (current, patch) => {
    const next = new URLSearchParams(current);
    Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value == null) next.delete(key);
        else next.set(key, String(value));
    });
    return next;
};
