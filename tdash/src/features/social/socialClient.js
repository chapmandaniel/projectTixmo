import axios from '../../lib/api';
import { buildWorkspace, cloneDefaultPhrases, cloneDefaultThresholds } from './mockWorkspace';
import { planDashboardPoll } from './pollSchedule';
import { simulateSandboxGraphError } from './sandboxErrors';

const disabled = { enabled: false, ready: false, phase: 'mock', poll: null, pollEnabled: false };

const dataOf = (response) => response?.data?.data || response?.data || {};

export const loadSocialConfig = async () => {
    try {
        const response = await axios.get('/social/config', { suppressGlobalError: true });
        const body = dataOf(response);
        if (body.enabled !== true) return disabled;
        return body;
    } catch {
        return disabled;
    }
};

export const workspaceForScene = (scene, graphError = '') => {
    const workspace = buildWorkspace(scene);
    if (!graphError) return workspace;
    return simulateSandboxGraphError(workspace, graphError, {
        'X-Business-Use-Case-Usage': `{"call_count":100,"total_cputime":100,"total_time":100,"estimated_time_to_regain_access":15,"code":${Number(graphError)}}`,
    });
};

export const shouldUseMockWorkspace = (filters = {}) =>
    Boolean(filters?.sceneRequested) || Boolean(filters?.graphError);

export const shouldUseLiveWorkspace = (config, filters = {}) =>
    Boolean(config?.enabled) && config?.ready === true && !shouldUseMockWorkspace(filters);

export const loadLiveWorkspace = async (filters = {}) => {
    const response = await axios.get('/social/workspace', {
        suppressGlobalError: true,
        params: {
            event: filters.event && filters.event !== 'all' ? filters.event : undefined,
            range: filters.range || '7d',
            account: filters.account && filters.account !== 'all' ? filters.account : undefined,
            from: filters.from || undefined,
            to: filters.to || undefined,
        },
    });
    return dataOf(response);
};

/** Returns `{ workspace, source: 'live'|'mock' }` for the dashboard loader. */
export const loadWorkspace = async (config, filters = {}) => {
    if (shouldUseMockWorkspace(filters)) {
        return {
            workspace: workspaceForScene(filters.scene || 'ready', filters.graphError),
            source: 'mock',
        };
    }
    if (shouldUseLiveWorkspace(config, filters)) {
        try {
            const workspace = await loadLiveWorkspace(filters);
            return { workspace, source: 'live' };
        } catch {
            return { workspace: workspaceForScene('ready'), source: 'mock' };
        }
    }
    // Feature on but not ready: keep the ready mock for local screenshots.
    return {
        workspace: workspaceForScene(filters.scene || 'ready', filters.graphError),
        source: 'mock',
    };
};

export const phrasesForWorkspace = (workspace) =>
    workspace?.phrases ? { ...workspace.phrases } : cloneDefaultPhrases();

export const thresholdsForWorkspace = (workspace) =>
    workspace?.thresholds ? { ...workspace.thresholds } : cloneDefaultThresholds();

export const teamForWorkspace = (workspace, fallback = []) => {
    if (Array.isArray(workspace?.team) && workspace.team.length) return workspace.team;
    return fallback;
};

export const pollPlanForWorkspace = (config, workspace, now = new Date(workspace.now)) =>
    planDashboardPoll(config, workspace.mode, now);

export const discoverSandboxPages = async (accessToken) => {
    const response = await axios.post(
        '/social/accounts/discover',
        { accessToken },
        { suppressGlobalError: true }
    );
    return dataOf(response).pages || [];
};

export const connectAccount = async ({ accessToken, pageId, eventIds }) => {
    const response = await axios.post(
        '/social/accounts/connect',
        { accessToken, pageId, eventIds },
        { suppressGlobalError: true }
    );
    return dataOf(response);
};

export const disconnectAccount = async (connectionId) => {
    const response = await axios.post(
        `/social/accounts/${connectionId}/disconnect`,
        {},
        { suppressGlobalError: true }
    );
    return dataOf(response);
};

export const syncNow = async () => {
    const response = await axios.post('/social/sync', {}, { suppressGlobalError: true });
    return dataOf(response);
};

export const patchIssue = async (issueId, body) => {
    const response = await axios.patch(`/social/issues/${issueId}`, body, {
        suppressGlobalError: true,
    });
    return dataOf(response).issue;
};

export const bulkIssues = async (body) => {
    const response = await axios.post('/social/issues/bulk', body, { suppressGlobalError: true });
    return dataOf(response);
};

const isDisplayThresholds = (value) =>
    Boolean(value?.NORMAL?.multiplier || value?.NORMAL?.minimum || value?.NORMAL?.unanswered);

const isPhraseTable = (value) =>
    Boolean(value?.Ticketing || value?.Refunds || value?.Safety || value?.Lineup);

const parseMultiplier = (value) => {
    if (typeof value === 'number') return value;
    const match = String(value || '').match(/([0-9]+(?:\.[0-9]+)?)/);
    return match ? Number(match[1]) : NaN;
};

const parseMinimum = (value) => {
    if (typeof value === 'number') return value;
    const match = String(value || '').match(/([0-9]+)/);
    return match ? Number(match[1]) : NaN;
};

const parseUnansweredMinutes = (value) => {
    if (typeof value === 'number') return value;
    const text = String(value || '');
    const minutes = text.match(/([0-9]+)\s*min/i);
    if (minutes) return Number(minutes[1]);
    const hours = text.match(/([0-9]+)\s*h/i);
    if (hours) return Number(hours[1]) * 60;
    return NaN;
};

const displayThresholdsToValues = (table) => {
    const modes = ['NORMAL', 'ON_SALE_DAY', 'EVENT_DAY'];
    const next = {};
    for (const mode of modes) {
        const row = table?.[mode] || {};
        const multiplier = parseMultiplier(row.multiplier);
        const minimum = parseMinimum(row.minimum);
        const unansweredMinutes = parseUnansweredMinutes(row.unanswered);
        if (![multiplier, minimum, unansweredMinutes].every(Number.isFinite)) return null;
        next[mode] = { multiplier, minimum, unansweredMinutes };
    }
    return next;
};

/** Adapt dashboard tables to the API body (`{ thresholds }` / `{ reset }` / `{ keywords }`). */
const thresholdsPayload = (body) => {
    if (!body || typeof body !== 'object') return body;
    if (body.reset === true || body.thresholds) return body;
    if (!isDisplayThresholds(body)) return body;
    if (JSON.stringify(body) === JSON.stringify(cloneDefaultThresholds())) return { reset: true };
    if (typeof body.NORMAL?.multiplier === 'number') return { thresholds: body };
    const parsed = displayThresholdsToValues(body);
    return parsed ? { thresholds: parsed } : { reset: true };
};

const keywordsPayload = (body) => {
    if (!body || typeof body !== 'object') return body;
    if (body.reset === true || body.keywords) return body;
    if (!isPhraseTable(body)) return body;
    const defaults = cloneDefaultPhrases();
    if (JSON.stringify(body) === JSON.stringify(defaults)) return { reset: true };
    return { keywords: body };
};

const holdPayload = (body) => {
    if (!body || typeof body !== 'object') return body;
    if (body.clear === true) return body;
    if (!body.mode) return { clear: true, eventId: body.eventId, until: body.until };
    return body;
};

export const saveThresholds = async (body) => {
    const response = await axios.patch('/social/settings/thresholds', thresholdsPayload(body), {
        suppressGlobalError: true,
    });
    return dataOf(response);
};

export const setHold = async (body) => {
    const response = await axios.post('/social/settings/hold', holdPayload(body), {
        suppressGlobalError: true,
    });
    return dataOf(response);
};

export const saveKeywords = async (body) => {
    const response = await axios.post('/social/settings/keywords', keywordsPayload(body), {
        suppressGlobalError: true,
    });
    return dataOf(response);
};

export const saveMapping = async (body) => {
    const response = await axios.post('/social/settings/mapping', body, {
        suppressGlobalError: true,
    });
    return dataOf(response);
};

export const triggerEmailCapture = async (body) => {
    const response = await axios.post('/social/email-captures/trigger', body, {
        suppressGlobalError: true,
    });
    return dataOf(response);
};
