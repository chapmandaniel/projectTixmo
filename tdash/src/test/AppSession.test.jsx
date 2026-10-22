import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { clearResetIntent, captureResetIntent } from '../lib/buyerRecovery';
import { storeSession } from '../lib/session';
import { AUTH_EXPIRED_EVENT, AUTH_EXPIRED_REASONS } from '../lib/session';

const LocationProbe = () => {
    const location = useLocation();
    return <div data-testid="session-location">{location.pathname}</div>;
};

const loginMock = vi.fn();
const logoutMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { notifications: [], approvals: [], data: { notifications: [], approvals: [] } } }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() }
        }
    },
    api: {
        get: vi.fn().mockResolvedValue({ approvals: [], events: [], data: { notifications: [], approvals: [], events: [] } }),
        post: vi.fn().mockResolvedValue({}),
        upload: vi.fn(),
    },
}));

vi.mock('../lib/auth', () => ({
    auth: {
        getCurrentUser: () => null,
        logout: (...args) => logoutMock(...args),
        login: (...args) => loginMock(...args),
        isAuthenticated: () => false,
    }
}));

describe('App session messaging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loginMock.mockResolvedValue({ id: '1', firstName: 'Test', role: 'ADMIN' });
    });

    it('shows an inactivity notice when the session expires', async () => {
        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/events/protected-link']}>
                    <LocationProbe />
                    <App />
                </MemoryRouter>
            );
        });

        await act(async () => {
            window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
                detail: { reason: AUTH_EXPIRED_REASONS.idle },
            }));
        });

        expect(screen.getByTestId('session-location')).toHaveTextContent('/dashboard');
        expect(screen.getByText(/signed out after 30 minutes of inactivity/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/name@example.com/i)).toBeInTheDocument();
    });

    it('lands on the main dashboard after signing in from a deep route', async () => {
        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/events/some-deep-link']}>
                    <App />
                </MemoryRouter>
            );
        });

        fireEvent.change(screen.getByPlaceholderText(/name@example.com/i), {
            target: { value: 'test@example.com' },
        });
        fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
            target: { value: 'password123' },
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /continue/i }));
        });

        await waitFor(() => {
            expect(screen.getByText(/welcome back, test/i)).toBeInTheDocument();
        });
    });
    it('opens the independent scanner route without dashboard sign in and preserves it on JWT expiry', async () => {
        await act(async () => {
            render(<MemoryRouter initialEntries={['/scan']}><LocationProbe /><App /></MemoryRouter>);
        });
        expect(await screen.findByLabelText('Scanner API key')).toBeInTheDocument();
        await act(async () => { window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason: AUTH_EXPIRED_REASONS.idle } })); });
        expect(screen.getByTestId('session-location')).toHaveTextContent('/scan');
        expect(screen.getByLabelText('Scanner API key')).toBeInTheDocument();
    });

    it('preserves the public recovery route across session expiry', async () => {
        await act(async () => { render(<MemoryRouter initialEntries={['/reset-password']}><LocationProbe /><App /></MemoryRouter>); });
        expect(await screen.findByLabelText('Buyer email')).toBeInTheDocument();
        await act(async () => { window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason: AUTH_EXPIRED_REASONS.expired } })); });
        expect(screen.getByTestId('session-location')).toHaveTextContent('/reset-password');
        expect(screen.getByLabelText('Buyer email')).toBeInTheDocument();
    });
    it.each([false, true])('reset completion clears only its captured browser session; newer login=%s', async newer => {
        let resolve;
        vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(done => { resolve = done; })));
        window.history.replaceState({}, '', '/reset-password#token=' + 'a'.repeat(64)); captureResetIntent();
        storeSession({ accessToken: 'synthetic-old', refreshToken: 'synthetic-old-refresh', user: { id: 'old' } });
        try {
            await act(async () => { render(<MemoryRouter initialEntries={['/reset-password']}><App /></MemoryRouter>); });
            fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'Synthetic-New1!' } });
            fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Synthetic-New1!' } });
            fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
            if (newer) storeSession({ accessToken: 'synthetic-new', refreshToken: 'synthetic-new-refresh', user: { id: 'new' } });
            await act(async () => { resolve({ ok: true, json: async () => ({ success: true, data: null }) }); });
            await screen.findByText(/Password changed/);
            expect(localStorage.getItem('access_token')).toBe(newer ? 'synthetic-new' : null);
        } finally { vi.unstubAllGlobals(); clearResetIntent(); localStorage.clear(); window.history.replaceState({}, '', '/'); }
    });

    it('drops old email intent on actual departure so wallet Forgot password opens a fresh request form', async () => {
        window.history.replaceState({}, '', '/reset-password#token=' + 'a'.repeat(64)); captureResetIntent();
        await act(async () => { render(<React.StrictMode><MemoryRouter initialEntries={['/reset-password']}><App /></MemoryRouter></React.StrictMode>); });
        expect(await screen.findByLabelText('New password')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: 'Return to wallet sign-in' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
        fireEvent.click(await screen.findByRole('link', { name: 'Forgot your password?' }));
        expect(await screen.findByLabelText('Buyer email')).toBeInTheDocument();
        expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
        clearResetIntent(); window.history.replaceState({}, '', '/');
    });

});
