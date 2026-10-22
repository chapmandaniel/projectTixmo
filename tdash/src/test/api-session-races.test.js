import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { getAccessToken, getStoredUser, storeSession } from '../lib/session';

describe('API session replacement races', () => {
    let adapter;
    let api;
    beforeEach(async () => {
        window.localStorage.clear();
        vi.resetModules();
        adapter = vi.fn();
        const create = axios.create.bind(axios);
        vi.spyOn(axios, 'create').mockImplementation((config) => create({ ...config, adapter }));
        api = (await import('../lib/api')).default;
        storeSession({ accessToken: 'old-access', refreshToken: 'old-refresh', user: { id: 'old-user' } });
    });
    afterEach(() => vi.restoreAllMocks());

    it('discards an old account response after account replacement', async () => {
        let finish;
        adapter.mockImplementation((config) => new Promise((resolve) => { finish = () => resolve({ config, status: 200, data: { private: 'old account data' } }); }));
        const request = api.get('/approvals');
        const rejected = expect(request).rejects.toMatchObject({ sessionChanged: true });
        await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
        storeSession({ accessToken: 'new-access', refreshToken: 'new-refresh', user: { id: 'new-user' } });
        finish();
        await rejected;
        expect(getAccessToken()).toBe('new-access');
        expect(getStoredUser().id).toBe('new-user');
    });

    it('does not overwrite or clear a new session when an old refresh finishes', async () => {
        let finishRefresh;
        adapter.mockImplementation((config) => {
            if (config.url === '/auth/refresh') {
                return new Promise((resolve) => {
                    finishRefresh = () => resolve({ config, status: 200, data: { data: { accessToken: 'stale-access', refreshToken: 'stale-refresh' } } });
                });
            }
            return Promise.reject({ config, response: { status: 401 } });
        });
        const request = api.get('/approvals');
        const rejected = expect(request).rejects.toMatchObject({ sessionChanged: true });
        await vi.waitFor(() => expect(finishRefresh).toBeTypeOf('function'));
        storeSession({ accessToken: 'new-access', refreshToken: 'new-refresh', user: { id: 'new-user' } });
        finishRefresh();
        await rejected;
        expect(getAccessToken()).toBe('new-access');
        expect(getStoredUser().id).toBe('new-user');
    });

    it('keeps logout bound to the former account when a new account signs in before dispatch', async () => {
        const { auth } = await import('../lib/auth');
        adapter.mockImplementation((config) => Promise.resolve({ config, status: 200, data: {} }));
        const logout = auth.logout();
        storeSession({ accessToken: 'new-access', refreshToken: 'new-refresh', user: { id: 'new-user' } });
        await logout;
        expect(adapter.mock.calls[0][0].headers.Authorization).toBe('Bearer old-access');
        expect(getAccessToken()).toBe('new-access');
        expect(getStoredUser().id).toBe('new-user');
    });
    it.each([
        [503, 'WAITING_ROOM_ACTIVE', 7, true, 7],
        [503, 'WAITING_ROOM_ACTIVE', '7', true, 5],
        [503, 'WAITING_ROOM_ACTIVE', -1, true, 5],
        [503, 'WAITING_ROOM_ACTIVE', 0, true, 5],
        [503, 'WAITING_ROOM_ACTIVE', 61, true, 5],
        [503, undefined, 7, false, undefined],
        [500, 'WAITING_ROOM_ACTIVE', 7, false, undefined],
    ])('classifies status %s marker %s delay %s without replay', async (status, code, retryAfter, busy, expected) => {
        const waiting = vi.fn(); const generic = vi.fn();
        window.addEventListener('tixmo:waiting-room', waiting);
        window.addEventListener('tixmo:global-error', generic);
        try {
            adapter.mockImplementation((config) => Promise.reject({ config, response: { status, data: { code, retryAfter } } }));
            await expect(api.post('/orders', {})).rejects.toMatchObject({ response: { status } });
            expect(waiting).toHaveBeenCalledTimes(busy ? 1 : 0);
            expect(generic).toHaveBeenCalledTimes(busy ? 0 : 1);
            if (busy) expect(waiting.mock.calls[0][0].detail.retryAfter).toBe(expected);
            expect(adapter).toHaveBeenCalledTimes(1);
            expect(getAccessToken()).toBe('old-access');
        } finally {
            window.removeEventListener('tixmo:waiting-room', waiting);
            window.removeEventListener('tixmo:global-error', generic);
        }
    });
    it('ignores a stale marked503 after session replacement', async () => {
        const waiting = vi.fn(); window.addEventListener('tixmo:waiting-room', waiting);
        let rejectOld;
        adapter.mockImplementation((config) => new Promise((resolve, reject) => { rejectOld = () => reject({ config, response: { status: 503, data: { code: 'WAITING_ROOM_ACTIVE' } } }); }));
        const request = api.post('/orders', {});
        const assertion = expect(request).rejects.toMatchObject({ sessionChanged: true });
        await vi.waitFor(() => expect(rejectOld).toBeTypeOf('function'));
        storeSession({ accessToken: 'new-access', refreshToken: 'new-refresh', user: { id: 'new-user' } });
        rejectOld(); await assertion; expect(waiting).not.toHaveBeenCalled();
        window.removeEventListener('tixmo:waiting-room', waiting);
    });

});
