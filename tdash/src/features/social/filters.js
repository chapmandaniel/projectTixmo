export const SOCIAL_TABS = ['overview', 'issues', 'posts', 'settings'];
export const SOCIAL_RANGES = ['today', '7d', '28d', 'custom'];
export const SOCIAL_ACCOUNTS = ['all', 'facebook', 'instagram'];
export const ISSUE_VIEWS = ['needs-action', 'unanswered', 'waves'];

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

export const readSocialFilters = (params) => ({
    tab: oneOf(params.get('tab'), SOCIAL_TABS, 'overview'),
    event: params.get('event') || 'all',
    range: oneOf(params.get('range'), SOCIAL_RANGES, '7d'),
    from: params.get('from') || '',
    to: params.get('to') || '',
    account: oneOf(params.get('account'), SOCIAL_ACCOUNTS, 'all'),
    scene: params.get('scene') || 'ready',
    connect: params.get('connect') || '',
    view: oneOf(params.get('view'), ISSUE_VIEWS, 'needs-action'),
});

export const writeSocialSearch = (current, patch) => {
    const next = new URLSearchParams(current);
    Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value == null) next.delete(key);
        else next.set(key, String(value));
    });
    return next;
};
