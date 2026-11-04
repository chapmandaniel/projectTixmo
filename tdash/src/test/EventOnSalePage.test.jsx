import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import EventOnSalePage, { EventOnSaleView } from '../pages/EventOnSalePage';

vi.mock('../lib/runtimeConfig', () => ({
    getApiBaseUrl: () => '/api/v1',
    getPaymentCurrency: () => 'cad',
    getPolicyLinks: () => ({
        termsUrl: 'https://tixmo.example/terms',
        privacyPolicyUrl: 'https://tixmo.example/privacy',
        refundPolicyUrl: 'https://tixmo.example/refunds',
    }),
}));

const event = {
    id: 'event-1',
    name: 'Neon Nights',
    slug: 'neon-nights',
    status: 'ON_SALE',
    startDatetime: '2099-11-20T23:30:00Z',
    timezone: 'America/St_Johns',
    description: '<b>Plain event description</b>',
    venue: { name: 'Signal Hall' },
    organization: { name: 'Signal Events' },
    ticketTypes: [
        {
            id: 'ga',
            name: 'General admission',
            price: '35',
            quantityAvailable: 2,
            maxPerOrder: 4,
        },
    ],
};
const Destination = () => {
    const location = useLocation();
    return (
        <p>
            {location.pathname}
            {location.search}
        </p>
    );
};
const renderView = (overrides = {}, preview = false) =>
    render(
        <MemoryRouter>
            <Routes>
                <Route
                    path="/"
                    element={
                        <EventOnSaleView
                            event={{ ...event, ...overrides }}
                            preview={preview}
                        />
                    }
                />
                <Route path="/checkout/:slug" element={<Destination />} />
            </Routes>
        </MemoryRouter>,
    );

describe('customer event on-sale page', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('supports unauthenticated ticket selection and hands the selection to checkout', () => {
        renderView();
        expect(
            screen.getByRole('heading', { name: 'Neon Nights' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Fri, Nov 20, 8:00 p.m. NST')).toBeInTheDocument();
        expect(screen.getByText('8:00 p.m. NST')).toBeInTheDocument();
        expect(screen.queryByText('America/St_Johns')).not.toBeInTheDocument();
        expect(
            screen.getByText('<b>Plain event description</b>'),
        ).toBeInTheDocument();
        const add = screen.getByRole('button', {
            name: 'Add one General admission ticket',
        });
        expect(
            screen.getByRole('button', { name: 'Continue to checkout' }),
        ).toBeDisabled();
        fireEvent.click(add);
        fireEvent.click(add);
        expect(add).toBeDisabled();
        expect(screen.getAllByText(/70\.00/)).toHaveLength(2);
        expect(screen.getByText('Price includes HST and all fees.')).toBeInTheDocument();
        expect(screen.getByText(/Each ticket gets one person in, once/)).toBeInTheDocument();
        expect(screen.getByText(/held for 15 minutes/)).toBeInTheDocument();
        expect(screen.getByText(/refund you in full within 14 days/)).toBeInTheDocument();
        expect(screen.getByText(/your old QR code stops working/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Refund policy' })).toHaveAttribute('href', 'https://tixmo.example/refunds');
        fireEvent.click(
            screen.getByRole('button', { name: 'Continue to checkout' }),
        );
        expect(
            screen.getByText('/checkout/neon-nights?tickets=ga%3A2'),
        ).toBeInTheDocument();
    });

    it('hides hidden ticket types and does not sell sold-out types', () => {
        renderView({
            ticketTypes: [
                {
                    id: 'hidden',
                    name: 'Staff hold',
                    status: 'HIDDEN',
                    price: '10',
                    quantityAvailable: 5,
                    maxPerOrder: 4,
                },
                {
                    id: 'sold',
                    name: 'Balcony',
                    status: 'SOLD_OUT',
                    price: '40',
                    quantityAvailable: 5,
                    maxPerOrder: 4,
                },
                event.ticketTypes[0],
            ],
        });
        expect(screen.queryByText('Staff hold')).not.toBeInTheDocument();
        expect(screen.getByText('Balcony')).toBeInTheDocument();
        expect(screen.getByText('Sold out')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Add one Balcony ticket' }),
        ).toBeDisabled();
    });

    it.each([
        [{ status: 'SOLD_OUT' }, 'Sold out'],
        [{ salesStart: '2099-11-01T00:00:00Z' }, 'On sale soon'],
        [{ salesEnd: '2020-01-01T00:00:00Z' }, 'Sales ended'],
        [{ startDatetime: '2020-01-01T00:00:00Z' }, 'Sales ended'],
        [{ startDatetime: '2020-01-01T00:00:00Z', endDatetime: '2099-01-01T00:00:00Z', ended: false }, 'Sales ended'],
    ])('disables sales for unavailable events: %s', (overrides, label) => {
        renderView(overrides);
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        expect(
            screen.getByRole('button', {
                name: 'Add one General admission ticket',
            }),
        ).toBeDisabled();
    });

    it('shows the mobile ticket shortcut only while the ticket selector is outside view', () => {
        let notifyVisibility;
        const disconnect = vi.fn();
        vi.stubGlobal(
            'IntersectionObserver',
            class {
                constructor(callback) {
                    notifyVisibility = callback;
                }
                observe() {}
                disconnect = disconnect;
            },
        );
        const view = renderView();
        // The hero has its own shortcut; the floating shortcut is the second.
        expect(
            screen.getAllByRole('button', {
                name: 'Choose tickets',
                hidden: true,
            }),
        ).toHaveLength(2);
        act(() => notifyVisibility([{ isIntersecting: true }]));
        expect(
            screen.getAllByRole('button', {
                name: 'Choose tickets',
                hidden: true,
            }),
        ).toHaveLength(1);
        expect(
            screen.getByRole('button', { name: 'Continue to checkout' }),
        ).toBeInTheDocument();
        act(() => notifyVisibility([{ isIntersecting: false }]));
        expect(
            screen.getAllByRole('button', {
                name: 'Choose tickets',
                hidden: true,
            }),
        ).toHaveLength(2);
        view.unmount();
        expect(disconnect).toHaveBeenCalledOnce();
    });

    it('keeps the sample preview from opening a real checkout', () => {
        renderView({}, true);
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Add one General admission ticket',
            }),
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Preview checkout' }),
        );
        expect(
            screen.getByText(
                'This is a sample event. Checkout opens for published events.',
            ),
        ).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('clears the effective selection when a sales window closes while browsing', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-20T18:00:00Z'));
        renderView({ salesEnd: '2026-10-20T18:00:01Z' });
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Add one General admission ticket',
            }),
        );
        expect(
            screen.getByRole('button', { name: 'Continue to checkout' }),
        ).toBeEnabled();
        act(() => vi.advanceTimersByTime(2000));
        expect(
            screen.getByRole('button', { name: 'Continue to checkout' }),
        ).toBeDisabled();
        expect(
            screen.getByLabelText('General admission tickets selected'),
        ).toHaveTextContent('0');
    });

    it('shows the included-fees line before a quantity is chosen and keeps one copy after', () => {
        renderView();
        expect(screen.getAllByText('Price includes HST and all fees.')).toHaveLength(1);
        expect(screen.getByText('Choose a quantity to continue.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Add one General admission ticket' }));
        expect(screen.getAllByText('Price includes HST and all fees.')).toHaveLength(1);
        expect(screen.queryByText('Choose a quantity to continue.')).not.toBeInTheDocument();
    });

    it('shows the earliest per-ticket onsale, ticks the countdown, then opens sales', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-09T21:30:00.000Z'));
        renderView({
            timezone: 'America/St_Johns',
            startDatetime: '2026-11-20T23:30:00.000Z',
            ticketTypes: [
                {
                    id: 'hidden',
                    name: 'Staff hold',
                    status: 'HIDDEN',
                    price: '10',
                    quantityAvailable: 5,
                    maxPerOrder: 4,
                    salesStart: '2026-11-09T22:00:00.000Z',
                },
                {
                    ...event.ticketTypes[0],
                    salesStart: '2026-11-09T22:30:00.000Z',
                },
                {
                    id: 'vip',
                    name: 'Balcony',
                    price: '55',
                    quantityAvailable: 4,
                    maxPerOrder: 4,
                    salesStart: '2026-11-10T22:30:00.000Z',
                },
            ],
        });
        expect(document.querySelector('.sf-sale-state')).toHaveTextContent('On sale soon');
        expect(screen.queryByText('Tickets unavailable')).not.toBeInTheDocument();
        expect(screen.getByText('On sale Mon, Nov 9, 7:00 p.m. NST')).toBeInTheDocument();
        expect(screen.queryByText('On sale Tue, Nov 10, 7:00 p.m. NST')).not.toBeInTheDocument();
        expect(screen.getByRole('timer')).toHaveTextContent('in 1 hour');
        expect(screen.getAllByText('Price includes HST and all fees.')).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Add one General admission ticket' })).toBeDisabled();

        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByRole('timer')).toHaveTextContent('in 59 minutes 59 seconds');

        act(() => {
            vi.setSystemTime(new Date('2026-11-09T22:30:00.000Z'));
            vi.advanceTimersByTime(1000);
        });
        expect(screen.queryByRole('timer')).not.toBeInTheDocument();
        expect(screen.queryByText('On sale Mon, Nov 9, 7:00 p.m. NST')).not.toBeInTheDocument();
        expect(document.querySelector('.sf-sale-state')).toHaveTextContent('On sale now');
        const add = screen.getByRole('button', { name: 'Add one General admission ticket' });
        expect(add).toBeEnabled();
        expect(screen.getAllByText('Price includes HST and all fees.')).toHaveLength(1);
        fireEvent.click(add);
        expect(screen.getAllByText('Price includes HST and all fees.')).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Continue to checkout' })).toBeEnabled();
    });

    it('formats a summer per-ticket onsale as Newfoundland daylight time', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-31T21:30:00.000Z'));
        renderView({
            timezone: 'America/St_Johns',
            ticketTypes: [{ ...event.ticketTypes[0], salesStart: '2026-10-31T22:30:00.000Z' }],
        });
        expect(screen.getByText('On sale Sat, Oct 31, 8:00 p.m. NDT')).toBeInTheDocument();
        expect(screen.getByRole('timer')).toHaveTextContent('in 1 hour');
        expect(screen.queryByText('Tickets unavailable')).not.toBeInTheDocument();
    });

    it.each([
        [{ ticketTypes: [] }, 'Tickets unavailable', false],
        [{ ticketTypes: [{ ...event.ticketTypes[0], status: 'SOLD_OUT', quantityAvailable: 0 }] }, 'Tickets unavailable', true],
        [{ ticketTypes: [{ ...event.ticketTypes[0], status: 'SOLD_OUT', quantityAvailable: 0, salesStart: '2099-11-01T00:00:00Z' }] }, 'Tickets unavailable', true],
        [{ status: 'SOLD_OUT', ticketTypes: [{ ...event.ticketTypes[0], salesStart: '2099-11-01T00:00:00Z' }] }, 'Sold out', true],
        [{ salesEnd: '2020-01-01T00:00:00Z', ticketTypes: [{ ...event.ticketTypes[0], salesStart: '2099-11-01T00:00:00Z' }] }, 'Sales ended', true],
        [{ startDatetime: '2020-01-01T00:00:00Z', ticketTypes: [{ ...event.ticketTypes[0], salesStart: '2099-11-01T00:00:00Z' }] }, 'Sales ended', true],
    ])('keeps a genuinely unavailable event on %j', (overrides, label, showsFees) => {
        renderView(overrides);
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        expect(screen.queryByRole('timer')).not.toBeInTheDocument();
        expect(screen.queryByText(/^On sale /)).not.toBeInTheDocument();
        if (showsFees) expect(screen.getAllByText('Price includes HST and all fees.')).toHaveLength(1);
        else expect(screen.queryByText('Price includes HST and all fees.')).not.toBeInTheDocument();
    });

    it('shows an ended event with no purchase controls', () => {
        renderView({
            ended: true,
            startDatetime: '2020-01-01T00:00:00Z',
            endDatetime: '2020-01-01T03:00:00Z',
        });
        expect(screen.getByRole('heading', { name: 'Neon Nights' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'This event has ended' })).toBeInTheDocument();
        expect(screen.getByText('Ticket sales are closed. Tickets you already bought are in My tickets.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add one General admission ticket' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Continue to checkout' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Choose tickets' })).not.toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'General admission quantity' })).not.toBeInTheDocument();
        expect(screen.queryByText('Price includes HST and all fees.')).not.toBeInTheDocument();
        expect(screen.queryByText('Sales ended')).not.toBeInTheDocument();
        expect(screen.queryByText('On sale soon')).not.toBeInTheDocument();
        expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });

    it('uses the same no-sale treatment for an undated event', () => {
        renderView({
            undated: true,
            ended: false,
            startDatetime: null,
            endDatetime: null,
            salesStart: '2099-11-01T00:00:00Z',
        });
        expect(screen.getByRole('heading', { name: "This event isn't open for sale yet" })).toBeInTheDocument();
        expect(screen.getByText("Tickets aren't on sale until the organizer sets a date.")).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add one General admission ticket' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Continue to checkout' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Choose tickets' })).not.toBeInTheDocument();
        expect(screen.queryByText('Price includes HST and all fees.')).not.toBeInTheDocument();
        expect(screen.queryByText('On sale soon')).not.toBeInTheDocument();
        expect(screen.queryByRole('timer')).not.toBeInTheDocument();
        expect(screen.queryByText('On sale now')).not.toBeInTheDocument();
    });

    it('provides a retry after a failed event request and renders no sample data', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: event }),
            });
        render(
            <MemoryRouter initialEntries={['/e/neon-nights']}>
                <Routes>
                    <Route path="/e/:slug" element={<EventOnSalePage />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(
            await screen.findByRole('heading', { name: 'Event unavailable' }),
        ).toBeInTheDocument();
        expect(screen.queryByText('Neon Nights')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(
            await screen.findByRole('heading', { name: 'Neon Nights' }),
        ).toBeInTheDocument();
        expect(fetch).toHaveBeenLastCalledWith(
            '/api/v1/events/public/neon-nights',
            expect.objectContaining({ cache: 'no-store' }),
        );
        await waitFor(() => expect(document.title).toBe('Neon Nights · Tixmo'));
    });
});

describe('composed storefront eligibility', () => {
    afterEach(cleanup);
    it.each([
        { ticketTypes: [{ ...event.ticketTypes[0], hasConfiguredTiers: true, tiers: [] }] },
        { status: 'PUBLISHED', salesPaused: true },
        { status: 'ON_SALE', salesPaused: true },
    ])('blocks selection and checkout handoff for %j', overrides => {
        renderView(overrides);
        const add = screen.getByRole('button', { name: 'Add one General admission ticket' });
        const checkout = screen.getByRole('button', { name: 'Continue to checkout' });
        expect(add).toBeDisabled();
        fireEvent.click(add);
        expect(checkout).toBeDisabled();
        fireEvent.click(checkout);
        expect(screen.queryByText(/\/checkout\/neon-nights/)).not.toBeInTheDocument();
        if (overrides.salesPaused) {
            expect(screen.queryByText('On sale now')).not.toBeInTheDocument();
            expect(screen.getAllByText('Sales paused').length).toBeGreaterThan(0);
        }
    });
});
