import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import App from '../App';
import { ACCESS_TOKEN_KEY, AUTH_EXPIRED_EVENT, emitAuthExpired, storeSession } from '../lib/session';

const mocks = vi.hoisted(() => ({ clients: [], login: vi.fn(), confirm: vi.fn(), loadStripe: vi.fn() }));
vi.mock('axios', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, default: { ...actual.default, create: (...args) => {
        const client = actual.default.create(...args);
        mocks.clients.push(client);
        return client;
    } } };
});
vi.mock('../lib/auth', () => ({ auth: {
    getCurrentUser: () => ({ id: 'old-buyer', email: 'old@example.com' }),
    login: (...args) => mocks.login(...args),
    logout: vi.fn().mockResolvedValue(undefined),
} }));
vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }) => children,
    PaymentElement: () => <div>Payment controls</div>,
    useStripe: () => ({ confirmPayment: mocks.confirm }),
    useElements: () => ({}),
}));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: (...args) => mocks.loadStripe(...args) }));

const orderId = '12345678-1234-1234-1234-123456789abc';
const entry = `/checkout/neon-nights?orderId=${orderId}&redirect_status=succeeded&payment_intent=untrusted&payment_intent_client_secret=untrusted`;
const response = (config, status = 'PAID', paymentStatus = 'SUCCEEDED') => ({
    config, status: 200, statusText: 'OK', headers: {},
    data: { data: { id: orderId, status, paymentStatus } },
});
const LocationProbe = () => {
    const location = useLocation();
    const navigate = useNavigate();
    return <><div data-testid="location">{location.pathname + location.search}</div>
        <button onClick={() => navigate(entry)}>Open return</button></>;
};
const mount = async (initialEntry = entry) => {
    await act(async () => {
        render(<MemoryRouter initialEntries={[initialEntry]}><LocationProbe /><App /></MemoryRouter>);
    });
};
const signIn = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    await act(async () => { fireEvent.submit(screen.getByLabelText('Password').closest('form')); });
};

describe('App checkout return session recovery', () => {
    let requests;
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        storeSession({ accessToken: 'test-access', refreshToken: 'test-refresh', user: { id: 'old-buyer' } });
        mocks.login.mockResolvedValue({ id: 'new-buyer', email: 'new@example.com' });
        requests = [];
        mocks.clients[0].defaults.adapter = vi.fn(async (config) => {
            requests.push({ method: config.method, url: config.url });
            return response(config);
        });
    });

    it.each(['auth event', 'storage logout', 'failed refresh'])('retains the candidate and restores only owner status after %s', async (reason) => {
        const adapter = mocks.clients[0].defaults.adapter;
        await mount();
        expect(await screen.findByText('Order confirmed. Payment succeeded.')).toBeInTheDocument();
        if (reason === 'failed refresh') {
            adapter.mockImplementationOnce(async (config) => {
                requests.push({ method: config.method, url: config.url });
                throw { config, response: { status: 401 } };
            });
            mocks.clients[1].defaults.adapter = vi.fn(async () => { throw new Error('Refresh rejected'); });
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check status again' })); });
            expect(mocks.clients[1].defaults.adapter).toHaveBeenCalledOnce();
            expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
        } else {
            await act(async () => {
                if (reason === 'auth event') emitAuthExpired();
                else window.dispatchEvent(new StorageEvent('storage', { key: ACCESS_TOKEN_KEY, newValue: null }));
            });
        }
        expect(screen.getByTestId('location')).toHaveTextContent(entry);
        expect(screen.getByText('Sign in to check your order. Payment has not been verified.')).toBeInTheDocument();
        expect(screen.queryByText('Order confirmed. Payment succeeded.')).not.toBeInTheDocument();
        expect(screen.queryByText(/old@example.com/)).not.toBeInTheDocument();
        const previousRequests = requests.length;
        mocks.clients[0].defaults.adapter.mockImplementation(async (config) => {
            requests.push({ method: config.method, url: config.url });
            return response(config, 'PENDING', 'PROCESSING');
        });
        await signIn();
        expect(mocks.login).toHaveBeenCalledWith('new@example.com', 'password123');
        expect(await screen.findByText('Awaiting server confirmation. Do not purchase again.')).toBeInTheDocument();
        expect(screen.getByTestId('location')).toHaveTextContent(entry);
        expect(requests.length).toBe(previousRequests + 1);
        expect(requests.every(({ method, url }) => method === 'get' && url === `/orders/${orderId}/recovery`)).toBe(true);
        expect(mocks.confirm).not.toHaveBeenCalled();
        expect(mocks.loadStripe).not.toHaveBeenCalled();
        expect(screen.queryByText('Payment controls')).not.toBeInTheDocument();
    });

    it('uses the current route after navigation and discards a previous identity response', async () => {
        await mount('/review/unknown');
        let resolveOld;
        mocks.clients[0].defaults.adapter = vi.fn((config) => new Promise((resolve) => {
            resolveOld = () => resolve(response(config));
        }));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open return' })); });
        await waitFor(() => expect(resolveOld).toBeTypeOf('function'));
        await act(async () => {
            window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
            resolveOld();
        });
        expect(screen.getByTestId('location')).toHaveTextContent(entry);
        expect(screen.queryByText('Order confirmed. Payment succeeded.')).not.toBeInTheDocument();
        expect(screen.getByText('Sign in to check your order. Payment has not been verified.')).toBeInTheDocument();
    });

    it.each(['auth event', 'storage logout'])('keeps a public event open after %s', async (reason) => {
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
            id: 'public-event', slug: 'public-show', name: 'Public Show', status: 'ON_SALE',
            startDatetime: '2099-11-20T23:30:00Z', ticketTypes: [],
        } }) });
        try {
            await mount('/e/public-show');
            expect(await screen.findByRole('heading', { name: 'Public Show' })).toBeInTheDocument();
            await act(async () => {
                if (reason === 'auth event') emitAuthExpired();
                else window.dispatchEvent(new StorageEvent('storage', { key: ACCESS_TOKEN_KEY, newValue: null }));
            });
            expect(screen.getByTestId('location')).toHaveTextContent('/e/public-show');
            expect(screen.getByRole('heading', { name: 'Public Show' })).toBeInTheDocument();
        } finally { global.fetch = originalFetch; }
    });
});
