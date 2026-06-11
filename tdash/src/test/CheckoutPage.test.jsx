import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
const registerMock = vi.fn();
const loginMock = vi.fn();

vi.mock('../lib/runtimeConfig', () => ({
    getApiBaseUrl: () => 'https://api.example.com/api/v1',
    getPaymentCurrency: () => 'usd',
    getPolicyLinks: () => runtimeMocks.policyLinks,
    getStripePublishableKey: () => runtimeMocks.stripePublishableKey,
}));

vi.mock('../lib/api', () => ({
    api: {
        post: (...args) => apiPost(...args),
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
    startDatetime: '2026-07-20T23:00:00.000Z',
    timezone: 'America/St_Johns',
    organization: { name: 'Tixmo Presents' },
    venue: { name: 'Signal Hall' },
    ticketTypes: [
        {
            id: 'ticket-ga',
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
    <MemoryRouter initialEntries={['/checkout/neon-nights']}>
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

        fireEvent.click(screen.getByRole('button', { name: /pay \$25.00/i }));

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
