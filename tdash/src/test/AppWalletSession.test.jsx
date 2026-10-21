import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_STORAGE_KEY, clearStoredSession, emitAuthExpired, storeSession } from '../lib/session';

const mocks = vi.hoisted(() => ({ clients: [] }));
vi.mock('axios', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, default: { ...actual.default, create: (...args) => {
        const client = actual.default.create(...args);
        mocks.clients.push(client);
        return client;
    } } };
});
const oldBuyer = { id: 'old-buyer', email: 'old@example.com' };
const newBuyer = { id: 'new-buyer', email: 'new@example.com' };
const response = (config, data) => ({ config, status: 200, statusText: 'OK', headers: {}, data: { data } });
const LocationProbe = () => { const location = useLocation(); return <p data-testid="location">{location.pathname}</p>; };
const mount = async () => act(async () => {
    render(<MemoryRouter initialEntries={['/wallet']}><LocationProbe /><App /></MemoryRouter>);
});
const signIn = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: newBuyer.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'synthetic-password' } });
    await act(async () => fireEvent.submit(screen.getByLabelText('Password').closest('form')));
};

describe('App wallet recovery with real auth and API interceptors', () => {
    let deny;
    let requests;
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        storeSession({ accessToken: 'old-access', refreshToken: 'old-refresh', user: oldBuyer });
        deny = false;
        requests = [];
        mocks.clients[0].defaults.adapter = vi.fn(async config => {
            requests.push(config.url);
            if (config.url === '/auth/login') return response(config, { accessToken: 'new-access', refreshToken: 'new-refresh', user: newBuyer });
            if (deny && config.url.startsWith('/orders/mine')) throw { config, response: { status: 401 } };
            const owner = config.headers.Authorization === 'Bearer old-access' ? 'old' : 'new';
            if (config.url.startsWith('/orders/mine')) return response(config, { orders: [{ id: `${owner}-order`, orderNumber: `${owner}-private-order`, status: 'PAID', totalAmount: 25, currency: 'cad' }], pagination: { pages: 1 } });
            if (config.url.startsWith('/tickets/mine')) return response(config, { tickets: [{ id: `${owner}-ticket`, status: 'VALID', order: { status: 'PAID' }, event: { name: `${owner}-private-event` } }], pagination: { pages: 1 } });
            if (config.url.endsWith('/qr')) return response(config, { qrCode: 'data:image/png;base64,synthetic' });
            throw new Error(`Unexpected route: ${config.url}`);
        });
        mocks.clients[1].defaults.adapter = vi.fn(async () => { throw new Error('Refresh rejected'); });
    });

    it.each(['failed refresh', 'missing tokens', 'terminal 401', 'storage expiry', 'idle expiry'])('retains wallet intent and reloads only the signed-in owner after %s', async reason => {
        await mount();
        await screen.findByText(/old-private-order/);
        fireEvent.click(screen.getByRole('button', { name: 'Show ticket' }));
        await screen.findByAltText('Ticket admission QR code');
        if (reason === 'storage expiry' || reason === 'idle expiry') {
            await act(async () => {
                clearStoredSession();
                if (reason === 'storage expiry') window.dispatchEvent(new StorageEvent('storage', { key: ACCESS_TOKEN_KEY, newValue: null }));
                else emitAuthExpired('idle');
            });
        } else {
            deny = true;
            if (reason === 'missing tokens') {
                localStorage.removeItem(ACCESS_TOKEN_KEY);
                localStorage.removeItem(REFRESH_TOKEN_KEY);
            }
            if (reason === 'terminal 401') mocks.clients[1].defaults.adapter.mockImplementation(async config => response(config, { accessToken: 'refreshed-access', refreshToken: 'refreshed-refresh' }));
            fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
        }
        await screen.findByRole('button', { name: 'Sign in', exact: true });
        expect(screen.getByTestId('location')).toHaveTextContent('/wallet');
        expect(screen.queryByText(/old-private-order/)).not.toBeInTheDocument();
        expect(screen.queryByText('old-private-event')).not.toBeInTheDocument();
        expect(screen.queryByAltText('Ticket admission QR code')).not.toBeInTheDocument();
        if (reason === 'missing tokens') expect(mocks.clients[1].defaults.adapter).not.toHaveBeenCalled();
        if (reason === 'failed refresh' || reason === 'terminal 401') expect(mocks.clients[1].defaults.adapter).toHaveBeenCalledOnce();
        deny = false;
        await signIn();
        await screen.findByText(/new-private-order/);
        expect(screen.getByTestId('location')).toHaveTextContent('/wallet');
        expect(screen.queryByText(/old-private-order/)).not.toBeInTheDocument();
        expect(screen.queryByAltText('Ticket admission QR code')).not.toBeInTheDocument();
        expect(requests.every(url => url.startsWith('/orders/mine') || url.startsWith('/tickets/mine') || url.endsWith('/qr') || url === '/auth/login')).toBe(true);
    });

    it('discards an old QR response after an account switch using the real generation fence', async () => {
        await mount();
        await screen.findByText(/old-private-order/);
        let resolveOld;
        const adapter = mocks.clients[0].defaults.adapter.getMockImplementation();
        mocks.clients[0].defaults.adapter.mockImplementation(config => config.url.endsWith('/qr')
            ? new Promise(resolve => { resolveOld = () => resolve(response(config, { qrCode: 'data:image/png;base64,old-private-qr' })); })
            : adapter(config));
        fireEvent.click(screen.getByRole('button', { name: 'Show ticket' }));
        await waitFor(() => expect(resolveOld).toBeTypeOf('function'));
        await act(async () => {
            storeSession({ accessToken: 'new-access', refreshToken: 'new-refresh', user: newBuyer });
            window.dispatchEvent(new StorageEvent('storage', { key: USER_STORAGE_KEY, newValue: JSON.stringify(newBuyer) }));
            resolveOld();
        });
        await screen.findByText(/new-private-order/);
        expect(screen.queryByText(/old-private-order/)).not.toBeInTheDocument();
        expect(screen.queryByAltText('Ticket admission QR code')).not.toBeInTheDocument();
        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('new-access');
        expect(screen.getByTestId('location')).toHaveTextContent('/wallet');
    });
});
