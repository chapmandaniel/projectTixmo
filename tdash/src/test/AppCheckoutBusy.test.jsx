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
const entry = '/checkout/neon-nights';
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


vi.mock('../lib/runtimeConfig', () => ({
    getApiBaseUrl: () => '/api/v1', getPaymentCurrency: () => 'cad', orderDisplayCurrency: (currency) => {
        const value = String(currency || '').trim().toLowerCase();
        return /^[a-z]{3}$/.test(value) ? value : 'cad';
    }, getStripePublishableKey: () => 'pk_test_mock',
    getPolicyLinks: () => ({ termsUrl: '/terms', privacyPolicyUrl: '/privacy', refundPolicyUrl: '/refunds' }),
}));
describe('actual App checkout busy feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks(); localStorage.clear();
        storeSession({ accessToken: 'test-access', refreshToken: 'test-refresh', user: { id: 'old-buyer' } });
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
            id: 'event-1', slug: 'neon-nights', name: 'Busy event', status: 'ON_SALE', startDatetime: '2099-01-01T00:00:00Z',
            ticketTypes: [{ id: 'ticket-1', name: 'General', status: 'ACTIVE', tierInventoryStatus: 'READY', price: 25, quantityAvailable: 10, maxPerOrder: 4, tiers: [] }],
        } }) });
    });
    it.each(['/orders', '/payments/create-intent'])('retains cart/auth after %s busy and waits for manual retry', async (target) => {
        const writes = [];
        mocks.clients[0].defaults.adapter = vi.fn(async (config) => {
            if (config.method === 'post') {
                writes.push(config.url);
                if (config.url === target) throw { config, response: { status: 503, data: { code: 'WAITING_ROOM_ACTIVE', retryAfter: 1, message: 'Busy' } } };
            }
            return { config, status: 200, data: { data: { id: 'held-order', eventId: 'event-1', status: 'PENDING', totalAmount: 25 } } };
        });
        await mount(); await screen.findByText('Busy event');
        fireEvent.click(screen.getByRole('button', { name: 'Increase General' }));
        const signedIn = screen.getByText(/Signed in as old@example.com/);
        const selected = screen.getByRole('button', { name: 'Decrease General' });
        await act(async () => fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i })));
        expect(await screen.findByRole('dialog')).toHaveTextContent('Checkout is busy');
        expect(screen.getByRole('button', { name: 'Try again in 1s' })).toBeDisabled();
        expect(signedIn).toBeInTheDocument(); expect(selected).toBeInTheDocument();
        const count = writes.length;
        await screen.findByRole('button', { name: 'Return to checkout' }, { timeout: 2000 });
        expect(writes).toHaveLength(count);
        fireEvent.click(screen.getByRole('button', { name: 'Return to checkout' }));
        expect(writes).toHaveLength(count);
        expect(screen.getByTestId('location')).toHaveTextContent('/checkout/neon-nights');
        expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('test-access');
        expect(mocks.confirm).not.toHaveBeenCalled();
        await act(async () => fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i })));
        expect(writes).toHaveLength(count + 1);
        expect(writes.at(-1)).toBe(target);
        if (target === '/payments/create-intent') expect(writes.filter((url) => url === '/orders')).toHaveLength(1);
    });
    it('shows unmarked503 generic feedback on actual checkout', async () => {
        mocks.clients[0].defaults.adapter = vi.fn(async (config) => { throw { config, response: { status: 503, data: { message: 'Service temporarily unavailable' } } }; });
        await mount(); await screen.findByText('Busy event');
        fireEvent.click(screen.getByRole('button', { name: 'Increase General' }));
        await act(async () => fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i })));
        expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByText(/Signed in as old@example.com/)).toBeInTheDocument();
    });
});
