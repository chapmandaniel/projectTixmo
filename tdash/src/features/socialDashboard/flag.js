const truthy = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const readLabsBranch = () => String(import.meta.env.VITE_APP_LABS_BRANCH || '').trim();

export const SOCIAL_DASHBOARD_FLAG = 'VITE_SOCIAL_COMMAND_CENTER_ENABLED';

/** Prototype is on in local Vite, Labs, or when the explicit flag is set. */
export const isSocialDashboardEnabled = () => (
    truthy(import.meta.env.VITE_SOCIAL_COMMAND_CENTER_ENABLED)
    || Boolean(readLabsBranch())
    || Boolean(import.meta.env.DEV)
);

/**
 * Keep the main nav unchanged in Vitest (DEV without the flag or Labs branch).
 * Labs and an explicit flag surface Social next to Analytics.
 */
export const isSocialDashboardNavVisible = () => (
    truthy(import.meta.env.VITE_SOCIAL_COMMAND_CENTER_ENABLED)
    || Boolean(readLabsBranch())
);
