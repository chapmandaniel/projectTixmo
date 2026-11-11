/**
 * Maps Meta Graph / sandbox error simulation payloads to dashboard states.
 * AC-SB-8: rate limit codes 4 / 17 / 32 (+ X-Business-Use-Case-Usage),
 * expired token 190/463, missing permission 10/200.
 */

export const RATE_LIMIT_CODES = new Set([4, 17, 32]);

const rateLimitCopy = (code) => {
    if (code === 4) {
        return 'Sync paused: the sandbox is limiting application requests (Graph code 4). Retrying at 4:30 PM NDT.';
    }
    if (code === 17) {
        return 'Sync paused: the sandbox is limiting user requests (Graph code 17). Retrying at 4:30 PM NDT.';
    }
    return 'Sync paused: the sandbox is limiting Page requests (Graph code 32). Retrying at 4:30 PM NDT.';
};

export const readGraphErrorCode = (payload) => {
    if (payload == null) return null;
    if (typeof payload === 'number' || typeof payload === 'string') {
        const code = Number(payload);
        return Number.isFinite(code) ? code : null;
    }
    const error = payload.error || payload;
    const code = Number(error?.code ?? error?.error_code ?? payload.code);
    return Number.isFinite(code) ? code : null;
};

export const applySandboxGraphError = (workspace, payload, headers = {}) => {
    const code = readGraphErrorCode(payload);
    if (code == null) return workspace;

    if (RATE_LIMIT_CODES.has(code)) {
        const usage = headers['x-business-use-case-usage'] || headers['X-Business-Use-Case-Usage'] || '';
        return {
            ...workspace,
            scene: 'rate-limited',
            graphErrorCode: code,
            rateLimit: rateLimitCopy(code),
            rateLimitUsage: usage || undefined,
            banners: [],
            permissionNote: '',
        };
    }

    if (code === 190) {
        return {
            ...workspace,
            scene: 'token-expired',
            graphErrorCode: code,
            accounts: workspace.accounts.map((account) => account.id === 'ig-pro'
                ? { ...account, status: 'NEEDS ATTENTION', lastSync: '2027-07-08T18:30:00.000Z', attention: 'sandbox token expired' }
                : account),
            banners: ['NEEDS ATTENTION (Sandbox): Instagram (sandbox) harbourfest_sbx stopped syncing 2 days ago: sandbox token expired. Data below may be out of date.'],
            rateLimit: '',
            permissionNote: '',
        };
    }

    if (code === 10) {
        return {
            ...workspace,
            scene: 'missing-permission',
            graphErrorCode: code,
            permissionNote: 'Insights unavailable: this sandbox connection has no insights access.',
            kpis: {
                ...workspace.kpis,
                reach: 'Pending',
                engagements: 'Pending',
                reachDetail: 'Missing permission',
                engagementDetail: 'Missing permission',
            },
            rateLimit: '',
            banners: [],
        };
    }

    return workspace;
};

/** Phase-1 proof path: apply a simulated Graph error without calling the network. */
export const simulateSandboxGraphError = (workspace, code, headers = {}) =>
    applySandboxGraphError(workspace, { error: { code: Number(code), type: 'OAuthException' } }, headers);
