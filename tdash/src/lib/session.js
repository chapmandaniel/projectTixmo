export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const USER_STORAGE_KEY = 'user';
export const SESSION_LAST_ACTIVITY_KEY = 'tixmo_last_activity_at';
export const AUTH_EXPIRED_EVENT = 'tixmo:auth-expired';

export const AUTH_EXPIRED_REASONS = {
    expired: 'expired',
    idle: 'idle',
};

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_TIMEOUT_MINUTES = SESSION_TIMEOUT_MS / (60 * 1000);

const ACTIVITY_STORAGE_THROTTLE_MS = 15 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'focus', 'visibilitychange'];

let lastActivityWriteAt = 0;
let lastKnownActivityAt = 0;

const getStorage = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.localStorage;
};

const getStoredValue = (key) => {
    const storage = getStorage();
    return storage ? storage.getItem(key) : null;
};

const setStoredValue = (key, value) => {
    const storage = getStorage();
    if (storage) {
        storage.setItem(key, value);
    }
};

const removeStoredValue = (key) => {
    const storage = getStorage();
    if (storage) {
        storage.removeItem(key);
    }
};

export const getAccessToken = () => getStoredValue(ACCESS_TOKEN_KEY);

export const getRefreshToken = () => getStoredValue(REFRESH_TOKEN_KEY);

export const getStoredUser = () => {
    const userStr = getStoredValue(USER_STORAGE_KEY);

    if (!userStr) {
        return null;
    }

    try {
        return JSON.parse(userStr);
    } catch (error) {
        console.warn('Failed to parse stored user', error);
        return null;
    }
};

export const markSessionActivity = ({ timestamp = Date.now(), forceStorage = false } = {}) => {
    lastKnownActivityAt = timestamp;

    if (forceStorage || (timestamp - lastActivityWriteAt) >= ACTIVITY_STORAGE_THROTTLE_MS) {
        setStoredValue(SESSION_LAST_ACTIVITY_KEY, String(timestamp));
        lastActivityWriteAt = timestamp;
    }

    return timestamp;
};

export const getLastActivityAt = () => {
    const storedValue = Number(getStoredValue(SESSION_LAST_ACTIVITY_KEY) || 0);
    return Math.max(lastKnownActivityAt, storedValue);
};

export const clearSessionActivity = () => {
    lastActivityWriteAt = 0;
    lastKnownActivityAt = 0;
    removeStoredValue(SESSION_LAST_ACTIVITY_KEY);
};

export const storeSession = ({ accessToken, refreshToken, user }) => {
    if (accessToken) {
        setStoredValue(ACCESS_TOKEN_KEY, accessToken);
    }

    if (refreshToken) {
        setStoredValue(REFRESH_TOKEN_KEY, refreshToken);
    }

    if (user) {
        setStoredValue(USER_STORAGE_KEY, JSON.stringify(user));
    }

    markSessionActivity({ forceStorage: true });
};

export const updateStoredTokens = ({ accessToken, refreshToken }) => {
    if (accessToken) {
        setStoredValue(ACCESS_TOKEN_KEY, accessToken);
    }

    if (refreshToken) {
        setStoredValue(REFRESH_TOKEN_KEY, refreshToken);
    }

    markSessionActivity();
};

export const clearStoredSession = () => {
    removeStoredValue(ACCESS_TOKEN_KEY);
    removeStoredValue(REFRESH_TOKEN_KEY);
    removeStoredValue(USER_STORAGE_KEY);
    clearSessionActivity();
};

export const emitAuthExpired = (reason = AUTH_EXPIRED_REASONS.expired) => {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
        detail: { reason },
    }));
};

export const createInactivityManager = ({ onTimeout, timeoutMs = SESSION_TIMEOUT_MS } = {}) => {
    let timeoutId = null;

    const clearScheduledCheck = () => {
        if (timeoutId) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    const scheduleCheck = () => {
        clearScheduledCheck();

        const lastActivityAt = getLastActivityAt() || markSessionActivity({ forceStorage: true });
        const remainingMs = Math.max(timeoutMs - (Date.now() - lastActivityAt), 250);

        timeoutId = window.setTimeout(() => {
            const latestActivityAt = getLastActivityAt();

            if (Date.now() - latestActivityAt >= timeoutMs) {
                onTimeout?.();
                return;
            }

            scheduleCheck();
        }, remainingMs);
    };

    const handleActivity = (event) => {
        if (event.type === 'visibilitychange' && document.visibilityState !== 'visible') {
            return;
        }

        markSessionActivity();
        scheduleCheck();
    };

    const handleStorage = (event) => {
        if (event.key === SESSION_LAST_ACTIVITY_KEY || event.key === ACCESS_TOKEN_KEY) {
            scheduleCheck();
        }
    };

    return {
        start() {
            if (typeof window === 'undefined') {
                return;
            }

            markSessionActivity({ forceStorage: true });
            scheduleCheck();

            ACTIVITY_EVENTS.forEach((eventName) => {
                window.addEventListener(eventName, handleActivity, { passive: true });
            });
            window.addEventListener('storage', handleStorage);
        },
        stop() {
            if (typeof window === 'undefined') {
                return;
            }

            clearScheduledCheck();

            ACTIVITY_EVENTS.forEach((eventName) => {
                window.removeEventListener(eventName, handleActivity);
            });
            window.removeEventListener('storage', handleStorage);
        },
        ping() {
            markSessionActivity({ forceStorage: true });
            scheduleCheck();
        },
    };
};
