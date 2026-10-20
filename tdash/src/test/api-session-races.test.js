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
});
