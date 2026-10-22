import React, { StrictMode } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BuyerPasswordResetPage from '../pages/BuyerPasswordResetPage';
import { captureResetIntent, clearResetIntent, getResetIntent } from '../lib/buyerRecovery';
import { storeSession } from '../lib/session';
const token = 'a'.repeat(64);
const reply = (ok = true, success = true) => ({ ok, json: async () => ({ success, data: null }) });
const mount = (props = {}) => render(<StrictMode><MemoryRouter><BuyerPasswordResetPage {...props} /></MemoryRouter></StrictMode>);
const enter = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const resetFields = () => { enter('New password', 'Synthetic-New1!'); enter('Confirm new password', 'Synthetic-New1!'); };
beforeEach(() => { localStorage.clear(); clearResetIntent(); window.history.replaceState({}, '', '/reset-password'); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply())); });
afterEach(() => { vi.unstubAllGlobals(); clearResetIntent(); });
describe('Buyer password recovery', () => {
    it('keeps a stripped fragment in memory through StrictMode and sends only a dedicated unauthenticated request', async () => {
        window.history.replaceState({}, '', `/reset-password#token=${token}`); captureResetIntent();
        expect(window.location.hash).toBe(''); expect(getResetIntent()).toBe(token);
        mount(); resetFields(); fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
        await screen.findByText(/Password changed/);
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe('/api/v1/auth/reset-password'); expect(options.credentials).toBe('omit'); expect(options.redirect).toBe('error');
        expect(options.headers).toEqual({ 'Content-Type': 'application/json' }); expect(JSON.parse(options.body)).toEqual({ token, password: 'Synthetic-New1!' });
        expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0); expect(getResetIntent()).toBe('');
        expect(screen.getByRole('link', { name: 'Return to wallet sign-in' })).toHaveAttribute('href', '/wallet');
    });
    it('normalizes email and displays the same generic initiation notice without automatic login', async () => {
        const onPasswordReset = vi.fn(); mount({ onPasswordReset }); enter('Buyer email', ' BUYER@synthetic.test ');
        fireEvent.click(screen.getByRole('button', { name: 'Email reset link' })); await screen.findByText(/If this email belongs/);
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: 'buyer@synthetic.test' }); expect(onPasswordReset).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
    });
    it('rejects bcrypt-truncating byte length with plain guidance before requesting', async () => {
        window.history.replaceState({}, '', `/reset-password#token=${token}`); captureResetIntent(); mount();
        const password = 'é'.repeat(40) + 'Aa1!'; enter('New password', password); enter('Confirm new password', password);
        fireEvent.click(screen.getByRole('button', { name: 'Change password' })); expect(await screen.findByRole('alert')).toHaveTextContent('Choose a shorter password.'); expect(fetch).not.toHaveBeenCalled();
    });
    it('refuses mismatched confirmation without a request', async () => {
        window.history.replaceState({}, '', `/reset-password#token=${token}`); captureResetIntent(); mount(); resetFields(); enter('Confirm new password', 'Different1!');
        fireEvent.click(screen.getByRole('button', { name: 'Change password' })); expect(await screen.findByRole('alert')).toHaveTextContent('Passwords must match'); expect(fetch).not.toHaveBeenCalled();
    });
    it.each(['', '#token=bogus', `#token=${token}&token=${token}`])('missing or invalid fragment offers another link %s', fragment => {
        window.history.replaceState({}, '', `/reset-password${fragment}`); captureResetIntent(); mount(); expect(screen.getByLabelText('Buyer email')).toBeInTheDocument(); expect(window.location.hash).toBe(''); expect(fetch).not.toHaveBeenCalled();
    });
    it('expired link can switch to a fresh email request without retaining old credentials', async () => {
        window.history.replaceState({}, '', `/reset-password#token=${token}`); captureResetIntent(); fetch.mockResolvedValueOnce(reply(false, false)); mount(); resetFields();
        fireEvent.click(screen.getByRole('button', { name: 'Change password' })); await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Request another link' }));
        expect(getResetIntent()).toBe(''); expect(screen.getByLabelText('Buyer email')).toBeInTheDocument(); expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    });
    it('a transport or malformed success never claims a password change and never echoes raw response errors', async () => {
        window.history.replaceState({}, '', `/reset-password#token=${token}`); captureResetIntent(); fetch.mockResolvedValueOnce(reply(true, false)); mount(); resetFields();
        fireEvent.click(screen.getByRole('button', { name: 'Change password' })); await screen.findByRole('alert'); expect(screen.queryByText(/Password changed/)).not.toBeInTheDocument();
    });
    it('deduplicates synchronous submits and does not apply completion after unmount', async () => {
        let resolve; fetch.mockReturnValueOnce(new Promise(done => { resolve = done; }));
        window.history.replaceState({}, '', `/reset-password#token=${token}`); captureResetIntent(); const onPasswordReset = vi.fn(); const mounted = mount({ onPasswordReset }); resetFields();
        const form = screen.getByRole('button', { name: 'Change password' }).closest('form'); fireEvent.submit(form); fireEvent.submit(form); expect(fetch).toHaveBeenCalledTimes(1);
        mounted.unmount(); await act(async () => { resolve(reply()); }); expect(onPasswordReset).not.toHaveBeenCalled();
    });
    it('passes the original browser session fence rather than a newer login to completion', async () => {
        let resolve; fetch.mockReturnValueOnce(new Promise(done => { resolve = done; }));
        storeSession({ accessToken: 'synthetic-old', refreshToken: 'synthetic-old-refresh', user: { id: 'old' } });
        window.history.replaceState({}, '', `/reset-password#token=${token}`); captureResetIntent(); const onPasswordReset = vi.fn(); mount({ onPasswordReset }); resetFields(); fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
        storeSession({ accessToken: 'synthetic-new', refreshToken: 'synthetic-new-refresh', user: { id: 'new' } }); await act(async () => { resolve(reply()); });
        await waitFor(() => expect(onPasswordReset).toHaveBeenCalledTimes(1)); expect(onPasswordReset.mock.calls[0][0].accessToken).toBe('synthetic-old'); expect(localStorage.getItem('access_token')).toBe('synthetic-new');
    });
});
