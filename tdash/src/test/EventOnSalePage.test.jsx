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
    getPolicyLinks: () => ({}),
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
        fireEvent.click(
            screen.getByRole('button', { name: 'Continue to checkout' }),
        );
        expect(
            screen.getByText('/checkout/neon-nights?tickets=ga%3A2'),
        ).toBeInTheDocument();
    });

    it.each([
        [{ status: 'SOLD_OUT' }, 'Sold out'],
        [{ salesStart: '2099-11-01T00:00:00Z' }, 'On sale soon'],
        [{ salesEnd: '2020-01-01T00:00:00Z' }, 'Sales ended'],
        [{ startDatetime: '2020-01-01T00:00:00Z' }, 'Sales ended'],
    ])('disables sales for unavailable events: %s', (overrides, label) => {
        renderView(overrides);
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        expect(
            screen.getByRole('button', {
                name: 'Add one General admission ticket',
            }),
        ).toBeDisabled();
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
