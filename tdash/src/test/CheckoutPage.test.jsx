import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import CheckoutPage from '../pages/CheckoutPage';

const runtimeMocks = vi.hoisted(() => ({
    policyLinks: {
        privacyPolicyUrl: 'https://tixmo.example/privacy',
        termsUrl: 'https://tixmo.example/terms',
        refundPolicyUrl: 'https://tixmo.example/refunds',
        organizerTermsUrl: 'https://tixmo.example/organizers',
    },
    stripePublishableKey: 'pk_test_checkout',
}));

const stripeMocks = vi.hoisted(() => ({
    confirmPayment: vi.fn(),
}));

const apiPost = vi.fn();
const apiGet = vi.fn();
const registerMock = vi.fn();
const loginMock = vi.fn();

vi.mock('../lib/runtimeConfig', () => ({
    getApiBaseUrl: () => 'https://api.example.com/api/v1',
    getPaymentCurrency: () => 'cad',
    orderDisplayCurrency: (currency) => {
        const value = String(currency || '').trim().toLowerCase();
        return /^[a-z]{3}$/.test(value) ? value : 'cad';
    },
    getPolicyLinks: () => runtimeMocks.policyLinks,
    getStripePublishableKey: () => runtimeMocks.stripePublishableKey,
}));

vi.mock('../lib/api', () => ({
    api: {
        post: (...args) => apiPost(...args),
        get: (...args) => apiGet(...args),
    },
}));

vi.mock('../lib/auth', () => ({
    auth: {
        register: (...args) => registerMock(...args),
        login: (...args) => loginMock(...args),
    },
}));

vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn(() => Promise.resolve({ id: 'stripe-instance' })),
}));

vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }) => <div data-testid="stripe-elements">{children}</div>,
    PaymentElement: () => <div>Card payment details</div>,
    useElements: () => ({ id: 'elements-instance' }),
    useStripe: () => ({
        confirmPayment: (...args) => stripeMocks.confirmPayment(...args),
    }),
}));

const eventPayload = {
    id: 'event-1',
    name: 'Neon Nights',
    slug: 'neon-nights',
    description: 'A high-energy launch event.',
    status: 'ON_SALE',
    startDatetime: '2099-07-20T23:00:00.000Z',
    timezone: 'America/St_Johns',
    organization: { name: 'Tixmo Presents' },
    venue: { name: 'Signal Hall' },
    ticketTypes: [
        {
            id: 'ticket-ga',
            status: 'ACTIVE', tierInventoryStatus: 'READY',
            name: 'General Admission',
            description: 'Floor access.',
            price: '25.00',
            quantityAvailable: 20,
            maxPerOrder: 4,
            tiers: [],
        },
    ],
};

const renderCheckout = (props = {}) => render(
    <MemoryRouter initialEntries={[props.entry || '/checkout/neon-nights']}>
        <Routes>
            <Route
                path="/checkout/:slug"
                element={<CheckoutPage user={props.user || null} onAuthenticated={props.onAuthenticated || vi.fn()} />}
            />
        </Routes>
    </MemoryRouter>
);

describe('CheckoutPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGet.mockReset();
        apiPost.mockReset();
        runtimeMocks.policyLinks = {
            privacyPolicyUrl: 'https://tixmo.example/privacy',
            termsUrl: 'https://tixmo.example/terms',
            refundPolicyUrl: 'https://tixmo.example/refunds',
            organizerTermsUrl: 'https://tixmo.example/organizers',
        };
        runtimeMocks.stripePublishableKey = 'pk_test_checkout';
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: eventPayload }),
        });
        apiPost
            .mockResolvedValueOnce({
                id: 'order-1',
                status: 'PENDING', eventId: 'event-1', currency: 'cad',
                totalAmount: '25.00',
            })
            .mockResolvedValueOnce({
                clientSecret: 'pi_secret_checkout',
                paymentIntentId: 'pi_checkout',
            });
        stripeMocks.confirmPayment.mockResolvedValue({
            paymentIntent: { status: 'succeeded' },
        });
    });

    it('restores event-page selections using current ticket limits', async () => {
        renderCheckout({ entry: '/checkout/neon-nights?tickets=ticket-ga%3A99%2Cunknown%3A2' });
        await screen.findByText('Neon Nights');
        expect(screen.getByText('4 x CA$25.00')).toBeInTheDocument();
        expect(screen.queryByText('99 x CA$25.00')).not.toBeInTheDocument();
    });

    it('shows required checkout policy links before preparing payment', async () => {
        renderCheckout({
            user: { id: 'buyer-1', email: 'buyer@example.com' },
        });

        expect(await screen.findByText('Neon Nights')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', 'https://tixmo.example/terms');
        expect(screen.getByRole('link', { name: 'Refund Policy' })).toHaveAttribute('href', 'https://tixmo.example/refunds');
        expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', 'https://tixmo.example/privacy');

        fireEvent.click(screen.getByRole('button', { name: 'Increase General Admission' }));
        fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i }));

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith('/orders', {
                items: [{ ticketTypeId: 'ticket-ga', quantity: 1 }],
            });
        });
        expect(apiPost).toHaveBeenCalledWith('/payments/create-intent', { orderId: 'order-1' });
        expect(await screen.findByText('Card payment details')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /pay CA\$25.00/i }));

        await waitFor(() => {
            expect(stripeMocks.confirmPayment).toHaveBeenCalledWith({
                elements: { id: 'elements-instance' },
                confirmParams: {
                    return_url: 'http://localhost:3000/checkout/neon-nights?orderId=order-1',
                },
                redirect: 'if_required',
            });
        });
    });

    const orderId = '12345678-1234-1234-1234-123456789abc';
    const buyer = { id: 'buyer-1', email: 'buyer@example.com' };
    const returnEntry = `/checkout/neon-nights?orderId=${orderId}&redirect_status=succeeded&payment_intent=forged`;
    const assertReadOnly = () => {
        expect(apiPost).not.toHaveBeenCalled();
        expect(stripeMocks.confirmPayment).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    };

    it.each([
        ['PENDING', 'PENDING', 'Awaiting server confirmation'],
        ['PENDING', 'PROCESSING', 'Awaiting server confirmation'],
        ['PAID', 'SUCCEEDED', 'Order confirmed. Payment succeeded.'],
        ['PENDING', 'FAILED', 'Payment failed'],
        ['CANCELLED', 'SUCCEEDED', 'closed or refunded'],
        ['REFUNDED', 'SUCCEEDED', 'closed or refunded'],
        ['PARTIALLY_REFUNDED', 'SUCCEEDED', 'closed or refunded'],
        ['PAID', 'FAILED', 'requires review'],
        ['PENDING', 'SUCCEEDED', 'requires review'],
    ])('uses authoritative %s/%s despite forged success without event lookup', async (status, paymentStatus, text) => {
        apiGet.mockResolvedValue({ id: orderId, status, paymentStatus });
        renderCheckout({ user: buyer, entry: returnEntry });
        expect(await screen.findByText(new RegExp(text))).toBeInTheDocument();
        expect(apiGet).toHaveBeenCalledWith(`/orders/${orderId}/recovery`);
        if (status === 'PAID' && paymentStatus === 'SUCCEEDED') {
            expect(screen.getByRole('link', { name: 'View my tickets and orders' })).toHaveAttribute('href', '/wallet');
        } else expect(screen.queryByRole('link', { name: 'View my tickets and orders' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Check status again' }));
        await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
        assertReadOnly();
    });

    it.each([401, 403, 404, 500, undefined])('handles lookup failure %s without disclosure', async (status) => {
        apiGet.mockRejectedValue({ response: { status, data: { message: 'private details' } } });
        renderCheckout({ user: buyer, entry: returnEntry });
        await screen.findByText(status === 401 ? /Sign in to check/ : [403, 404].includes(status) ? /This order is unavailable/ : /payment status is unknown/);
        expect(screen.queryByText(/private details/)).not.toBeInTheDocument();
        assertReadOnly();
    });

    it.each(['?redirect_status=succeeded', '?orderId=bad', '?orderId=', `?orderId=${orderId}&orderId=${orderId}`])('rejects malformed return %s', async (query) => {
        renderCheckout({ user: buyer, entry: `/checkout/neon-nights${query}` });
        expect(await screen.findByText(/valid order reference is required/)).toBeInTheDocument();
        expect(apiGet).not.toHaveBeenCalled();
        assertReadOnly();
    });

    it.each([{}, { id: orderId, status: 'PAID', paymentStatus: 'BOGUS' }, { id: 'other', status: 'PAID', paymentStatus: 'SUCCEEDED' }, { id: orderId, status: 'PAID', paymentStatus: 'SUCCEEDED', tickets: ['secret'] }])('rejects malformed or excessive DTO %j', async (data) => {
        apiGet.mockResolvedValue(data);
        renderCheckout({ user: buyer, entry: returnEntry });
        expect(await screen.findByText(/Unable to verify the order response/)).toBeInTheDocument();
        assertReadOnly();
    });

    it('preserves candidate through sign-in and ignores a stale identity response', async () => {
        let resolveOld;
        apiGet.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
        apiGet.mockResolvedValue({ id: orderId, status: 'PENDING', paymentStatus: 'PROCESSING' });
        const mount = (user) => <MemoryRouter initialEntries={[returnEntry]}><CheckoutPage user={user} onAuthenticated={vi.fn()} /></MemoryRouter>;
        const view = render(mount(buyer));
        await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
        view.rerender(mount(null));
        expect(screen.getByText(/Sign in to check/)).toBeInTheDocument();
        await act(async () => resolveOld({ id: orderId, status: 'PAID', paymentStatus: 'SUCCEEDED' }));
        expect(screen.queryByText(/Order confirmed/)).not.toBeInTheDocument();
        view.rerender(mount({ id: 'buyer-2' }));
        expect(await screen.findByText(/Awaiting server confirmation/)).toBeInTheDocument();
        view.unmount();
        render(mount(buyer));
        expect(await screen.findByText(/Awaiting server confirmation/)).toBeInTheDocument();
        assertReadOnly();
    });

    it('discards stale query responses and checks only the new candidate', async () => {
        let resolveOld;
        const nextId = '87654321-4321-4321-4321-cba987654321';
        apiGet.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
        apiGet.mockResolvedValue({ id: nextId, status: 'PENDING', paymentStatus: 'PENDING' });
        const Navigation = () => {
            const navigate = useNavigate();
            return <button onClick={() => navigate(`/checkout/closed-event?orderId=${nextId}`)}>Change return</button>;
        };
        render(<MemoryRouter initialEntries={[returnEntry]}><Navigation /><CheckoutPage user={buyer} /></MemoryRouter>);
        await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByText('Change return'));
        expect(await screen.findByText(/Awaiting server confirmation/)).toBeInTheDocument();
        await act(async () => resolveOld({ id: orderId, status: 'PAID', paymentStatus: 'SUCCEEDED' }));
        expect(screen.queryByText(/Order confirmed/)).not.toBeInTheDocument();
        expect(apiGet).toHaveBeenLastCalledWith(`/orders/${nextId}/recovery`);
        assertReadOnly();
    });

    it('blocks checkout when approved policy URLs are missing', async () => {
        runtimeMocks.policyLinks = {
            privacyPolicyUrl: '',
            termsUrl: '',
            refundPolicyUrl: '',
            organizerTermsUrl: '',
        };

        renderCheckout({
            user: { id: 'buyer-1', email: 'buyer@example.com' },
        });

        expect(await screen.findByText('Neon Nights')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Increase General Admission' }));

        expect(screen.getByText(/blocked until approved Terms, Refund Policy, and Privacy Policy URLs are configured/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /continue to secure payment/i })).toBeDisabled();
        expect(apiPost).not.toHaveBeenCalled();
    });

    it('lets a new buyer create an account before checkout', async () => {
        const onAuthenticated = vi.fn();
        registerMock.mockResolvedValue({ id: 'buyer-2', email: 'newbuyer@example.com' });

        renderCheckout({ onAuthenticated });

        expect(await screen.findByText('Neon Nights')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'New' } });
        fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Buyer' } });
        fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'newbuyer@example.com' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'BuyerPass123!' } });
        fireEvent.click(screen.getByRole('button', { name: /create buyer account/i }));

        await waitFor(() => {
            expect(registerMock).toHaveBeenCalledWith({
                firstName: 'New',
                lastName: 'Buyer',
                email: 'newbuyer@example.com',
                password: 'BuyerPass123!',
            });
        });
        expect(onAuthenticated).toHaveBeenCalledWith({ id: 'buyer-2', email: 'newbuyer@example.com' });
    });
});


describe('open-page sale boundaries', () => {
    const opening = Date.parse('2026-11-09T13:30:00Z');
    const buyer = { id: 'buyer-1', email: 'buyer@example.com' };
    const ticket = { ...eventPayload.ticketTypes[0] };
    const mount = async (overrides = {}, ticketOverrides = {}) => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
            ...eventPayload, salesStart: new Date(opening).toISOString(),
            salesEnd: new Date(opening + 1000).toISOString(), ...overrides,
            ticketTypes: [{ ...ticket, ...ticketOverrides }],
        } }) });
        await act(async () => { renderCheckout({ user: buyer }); });
    };
    beforeEach(() => {
        vi.clearAllMocks(); apiPost.mockReset(); apiGet.mockReset();
        vi.useFakeTimers(); vi.setSystemTime(opening - 1);
    });
    afterEach(() => vi.useRealTimers());
    it('opens at the exact event boundary and closes a selected cart at the exact end without payment calls', async () => {
        await mount();
        const increase = screen.getByRole('button', { name: 'Increase General Admission' });
        const proceed = screen.getByRole('button', { name: /continue to secure payment/i });
        expect(increase).toBeDisabled();
        await act(async () => vi.advanceTimersByTime(1));
        expect(increase).toBeEnabled(); fireEvent.click(increase);
        expect(proceed).toBeEnabled();
        await act(async () => vi.advanceTimersByTime(999));
        expect(proceed).toBeEnabled();
        await act(async () => vi.advanceTimersByTime(1));
        expect(increase).toBeDisabled(); expect(proceed).toBeDisabled();
        expect(apiPost).not.toHaveBeenCalled();
    });
    it('intersects a narrower ticket window instead of extending event eligibility', async () => {
        await mount({}, { salesStart: new Date(opening + 100).toISOString(), salesEnd: new Date(opening + 500).toISOString() });
        const increase = screen.getByRole('button', { name: 'Increase General Admission' });
        await act(async () => vi.advanceTimersByTime(100)); expect(increase).toBeDisabled();
        await act(async () => vi.advanceTimersByTime(1)); expect(increase).toBeEnabled();
        await act(async () => vi.advanceTimersByTime(400)); expect(increase).toBeDisabled();
    });
    it('changes pricing tiers at their half-open boundary and respects remaining tier capacity', async () => {
        vi.setSystemTime(opening);
        await mount({}, { tiers: [
            { id: 'early', isActive: true, price: '12', endsAt: new Date(opening + 500).toISOString(), quantityLimit: 1, quantitySold: 0, quantityHeld: 0 },
            { id: 'late', isActive: true, price: '18', startsAt: new Date(opening + 500).toISOString(), quantityLimit: 2, quantitySold: 0, quantityHeld: 1 },
        ] });
        const increase = screen.getByRole('button', { name: 'Increase General Admission' });
        expect(screen.getByText('CA$12.00')).toBeInTheDocument(); fireEvent.click(increase);
        expect(increase).toBeDisabled();
        await act(async () => vi.advanceTimersByTime(500));
        expect(screen.queryByText('CA$12.00')).not.toBeInTheDocument();
        expect(screen.getAllByText('CA$18.00').length).toBeGreaterThan(0);
        expect(increase).toBeDisabled();
    });
    it('does not restart payment or revoke an existing reservation at sale close', async () => {
        vi.setSystemTime(opening);
        apiPost.mockResolvedValueOnce({ id: 'held-order', status: 'PENDING', totalAmount: '25', currency: 'cad' })
            .mockResolvedValueOnce({ clientSecret: 'held-secret' });
        await mount();
        fireEvent.click(screen.getByRole('button', { name: 'Increase General Admission' }));
        await act(async () => fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i })));
        expect(screen.getByText('Card payment details')).toBeInTheDocument();
        await act(async () => vi.advanceTimersByTime(1000));
        expect(screen.getByText('Card payment details')).toBeInTheDocument();
        expect(apiPost).toHaveBeenCalledTimes(2);
        expect(stripeMocks.confirmPayment).not.toHaveBeenCalled();
        expect(screen.queryByText(/Order confirmed/)).not.toBeInTheDocument();
    });
    it('does not turn a skewed browser selection into entitlement when the API rejects', async () => {
        vi.setSystemTime(opening);
        await mount();
        apiPost.mockRejectedValue({ response: { data: { message: 'Event is not available for purchase' } } });
        fireEvent.click(screen.getByRole('button', { name: 'Increase General Admission' }));
        await act(async () => fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i })));
        expect(screen.getByText('Event is not available for purchase')).toBeInTheDocument();
        expect(apiPost).toHaveBeenCalledTimes(1); expect(apiPost.mock.calls[0][0]).toBe('/orders');
        expect(screen.queryByText(/Order confirmed/)).not.toBeInTheDocument();
        expect(stripeMocks.confirmPayment).not.toHaveBeenCalled();
    });
    it('retains selection but blocks a new purchase after authoritative SALES_PAUSED rejection', async () => {
        apiPost.mockReset().mockRejectedValueOnce({ response: { status: 409, data: { errors: { code: 'SALES_PAUSED' } } } });
        vi.setSystemTime(opening);
        await mount();
        fireEvent.click(screen.getByRole('button', { name: 'Increase General Admission' }));
        await act(async () => fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i })));
        expect(screen.getByText('Ticket sales are temporarily paused. Existing orders and tickets remain available.')).toBeInTheDocument();
        expect(apiPost).toHaveBeenCalledTimes(1);
        expect(apiPost.mock.calls[0][0]).toBe('/orders');
        expect(screen.getByRole('button', { name: /continue to secure payment/i })).toBeDisabled();
    });

});
