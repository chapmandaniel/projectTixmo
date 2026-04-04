import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInactivityManager } from '../lib/session';

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
});
