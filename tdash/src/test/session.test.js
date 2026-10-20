import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInactivityManager, clearStoredSession, storeSession } from '../lib/session';

describe('session inactivity manager', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        window.localStorage.clear();
    });

    it('extends the session window when activity occurs before the timeout', () => {
        const onTimeout = vi.fn();
        const inactivityManager = createInactivityManager({
            onTimeout,
            timeoutMs: 1000,
        });

        inactivityManager.start();

        vi.advanceTimersByTime(800);
        window.dispatchEvent(new Event('pointerdown'));

        vi.advanceTimersByTime(800);
        expect(onTimeout).not.toHaveBeenCalled();

        vi.advanceTimersByTime(250);
        expect(onTimeout).toHaveBeenCalledTimes(1);

        inactivityManager.stop();
    });

    it('clears private and legacy caches on logout and account replacement', () => {
        for (const storage of [window.localStorage, window.sessionStorage]) {
            storage.setItem('tixmo:approvals-dashboard-cache:old-owner', 'private');
            storage.setItem('tixmo:approvals-dashboard-cache', 'legacy');
            storage.setItem('tixmo_personal_todos', 'private');
            storage.setItem('theme', 'dark');
        }
        storeSession({ accessToken: 'new-access', user: { id: 'new-user' } });
        expect(window.sessionStorage.getItem('tixmo:approvals-dashboard-cache')).toBeNull();
        expect(window.localStorage.getItem('tixmo_personal_todos')).toBeNull();
        window.sessionStorage.setItem('tixmo:approvals-dashboard-cache:new-user', 'new private');
        clearStoredSession();
        expect(window.sessionStorage.getItem('tixmo:approvals-dashboard-cache:new-user')).toBeNull();
        expect(window.localStorage.getItem('theme')).toBe('dark');
    });
});
