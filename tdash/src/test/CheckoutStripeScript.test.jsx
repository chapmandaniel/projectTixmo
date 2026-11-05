import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CheckoutPage from '../pages/CheckoutPage';

vi.mock('../lib/runtimeConfig', () => ({
    getApiBaseUrl: () => 'https://api.example.com/api/v1',
    getPaymentCurrency: () => 'cad',
    orderDisplayCurrency: () => 'cad',
    getPolicyLinks: () => ({
        privacyPolicyUrl: 'https://tixmo.example/privacy',
        termsUrl: 'https://tixmo.example/terms',
        refundPolicyUrl: 'https://tixmo.example/refunds',
    }),
    getStripePublishableKey: () => 'pk_test_checkout',
}));

vi.mock('../lib/api', () => ({
    api: { post: vi.fn(), get: vi.fn() },
}));

vi.mock('../lib/auth', () => ({
    auth: { register: vi.fn(), login: vi.fn() },
}));

const eventPayload = {
    id: 'event-1',
    name: 'Neon Nights',
    slug: 'neon-nights',
    status: 'ON_SALE',
    startDatetime: '2099-07-20T23:00:00.000Z',
    timezone: 'America/St_Johns',
    ticketTypes: [
        {
            id: 'ticket-ga',
            status: 'ACTIVE',
            tierInventoryStatus: 'READY',
            name: 'General Admission',
            price: '25.00',
            quantityAvailable: 20,
            maxPerOrder: 4,
            tiers: [],
        },
    ],
};

const stripeScripts = () => [...document.querySelectorAll('script')].filter((node) =>
    String(node.src || '').includes('js.stripe.com')
);

const renderCheckout = (event) => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: event }),
    });
    return render(
        <MemoryRouter initialEntries={['/checkout/neon-nights']}>
            <Routes>
                <Route path="/checkout/:slug" element={<CheckoutPage user={null} onAuthenticated={vi.fn()} />} />
            </Routes>
        </MemoryRouter>,
    );
};

const settleStripeImport = async () => {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
};

describe('checkout Stripe.js requests', () => {
    afterEach(() => {
        cleanup();
        for (const node of stripeScripts()) node.remove();
        delete window.Stripe;
    });

    it.each([
        ['ended', { ended: true }, 'This event has ended'],
        ['undated', { undated: true, startDatetime: null, endDatetime: null }, "This event isn't open for sale yet"],
        ['draft', {
            status: 'DRAFT',
            ended: false,
            undated: true,
            startDatetime: '2020-01-01T00:00:00.000Z',
            endDatetime: '2020-01-01T03:00:00.000Z',
        }, "This event isn't open for sale yet"],
    ])('does not request js.stripe.com for a %s checkout', async (_label, flags, heading) => {
        renderCheckout({ ...eventPayload, ...flags });
        expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
        await settleStripeImport();
        expect(stripeScripts()).toEqual([]);
    });

    it('requests Stripe.js when checkout is open', async () => {
        renderCheckout(eventPayload);
        expect(await screen.findByText('Secure checkout')).toBeInTheDocument();
        await settleStripeImport();
        expect(stripeScripts().map((node) => node.src)).toEqual([
            'https://js.stripe.com/dahlia/stripe.js',
        ]);
    });
});
