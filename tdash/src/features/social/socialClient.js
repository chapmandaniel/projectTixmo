import axios from '../../lib/api';
import { buildWorkspace } from './mockWorkspace';
import { planDashboardPoll } from './pollSchedule';

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

export const workspaceForScene = (scene) => buildWorkspace(scene);

export const pollPlanForWorkspace = (config, workspace, now = new Date(workspace.now)) =>
    planDashboardPoll(config, workspace.mode, now);
