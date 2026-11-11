import axios from '../../lib/api';
import { buildWorkspace } from './mockWorkspace';
import { planDashboardPoll } from './pollSchedule';
import { simulateSandboxGraphError } from './sandboxErrors';

const disabled = { enabled: false, ready: false, phase: 'mock', poll: null };

export const loadSocialConfig = async () => {
    try {
        const response = await axios.get('/social/config', { suppressGlobalError: true });
        const body = response?.data?.data || response?.data || {};
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

export const pollPlanForWorkspace = (config, workspace, now = new Date(workspace.now)) =>
    planDashboardPoll(config, workspace.mode, now);
