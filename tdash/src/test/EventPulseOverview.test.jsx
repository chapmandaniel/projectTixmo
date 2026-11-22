import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventPulseOverview from '../features/eventPulse/EventPulseOverview';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../lib/api', () => ({ default: mocks }));

const DAY = 86400000;
const NOW = new Date('2026-11-16T15:00:00Z').getTime();
const iso = (ms) => new Date(ms).toISOString();
const wrapped = (data) => ({ data: { data } });
const salesByDay = Array.from({ length: 14 }, (_, i) => ({ date: iso(NOW - (13 - i) * DAY).slice(0, 10), orders: 15, tickets: i < 7 ? 30 : 40, revenue: 2000 }));

const event = {
    id: 'evt-harbour', name: 'Harbour Lights Festival', status: 'ON_SALE', capacity: 3560, currency: 'CAD', timezone: 'America/St_Johns',
    salesStart: iso(NOW - 178 * DAY), startDatetime: iso(NOW + 26 * DAY), endDatetime: iso(NOW + 26 * DAY + 7 * 3600000),
};

const respond = ({ stats = { ticketsSold: 2404, ticketsUsed: 0 } } = {}) => mocks.get.mockImplementation((url) => {
    if (url === '/analytics/sales') return Promise.resolve(wrapped({ totalRevenue: 26861.32, totalOrders: 162, salesByDay }));
    if (String(url).endsWith('/stats')) return Promise.resolve(wrapped(stats));
    if (String(url).startsWith('/ticket-types')) return Promise.resolve({ data: [
        { id: 'vip', name: 'VIP Deck', price: 189, quantity: 260, sold: 260, status: 'SOLD_OUT' },
        { id: 'ga', name: 'General Admission', price: 69, quantity: 2200, sold: 1576, status: 'ACTIVE' },
    ] });
    if (url === '/tasks') return Promise.resolve({ data: [{ id: 't1', title: 'Confirm stage-two power and generator backup', status: 'IN_PROGRESS', eventId: 'evt-harbour', dueDate: iso(NOW - 2 * DAY) }] });
    if (String(url).startsWith('/approvals')) return Promise.resolve({ approvals: [] });
    if (url === '/orders') return Promise.resolve(wrapped({ orders: [] }));
    return Promise.reject(new Error(`unexpected ${url}`));
});

const show = (props = {}) => render(<MemoryRouter><EventPulseOverview event={event} isDark now={NOW} {...props} /></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); });

describe('Event pulse overview', () => {
    it('leads with the verdict, Moose\'s read and the sold bar before any table', async () => {
        respond();
        show();
        expect(await screen.findByTestId('pulse-verdict')).toHaveTextContent('Sizzling Hot');
        expect(screen.getByTestId('pulse-countdown')).toHaveTextContent('26days to go');
        const read = screen.getByTestId('moose-read');
        expect(read).toHaveTextContent('Harbour Lights Festival is flying.');
        expect(read).toHaveTextContent('You have sold 68% with 26 days to go.');
        expect(read).toHaveTextContent('VIP Deck is sold out, so General Admission is carrying sales now.');
        expect(screen.getByTestId('moose-needs-you')).toHaveTextContent(/need(s)? you: .*1 task overdue/);
        expect(screen.getByTestId('moose-ticket-tip')).toHaveTextContent('VIP Deck sold out first.');
        expect(screen.getByTestId('pulse-ticket-types')).toHaveTextContent('VIP Deck · $189');
        expect(screen.getByTestId('pulse-bar')).toHaveTextContent('2,404 of 3,560 tickets sold');
        expect(screen.getByTestId('pulse-usual-marker')).toBeInTheDocument();
        expect(screen.getByTestId('sales-path-chart')).toBeInTheDocument();
        expect(screen.queryByText('Paid revenue')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Revenue currency')).not.toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledWith('/analytics/sales', { params: { eventId: 'evt-harbour' } });
    });

    it('shows five vital signs that open the dashboard behind each one', async () => {
        respond();
        show();
        const signs = await screen.findByTestId('vital-signs');
        expect(within(signs).getAllByRole('link')).toHaveLength(5);
        expect(screen.getByTestId('vital-sign-sales')).toHaveTextContent('Ahead of pace');
        expect(screen.getByTestId('vital-sign-interest')).toHaveAttribute('href', '/analytics?page=harbour-lights-festival');
        expect(screen.getByTestId('vital-sign-safety')).toHaveAttribute('href', '/scamswarm?event=Harbour%20Lights%20Festival');
        expect(screen.getByTestId('vital-sign-ready')).toHaveTextContent('1 task overdue');
        expect(screen.getByTestId('vital-sign-ready')).toHaveAttribute('href', '/todo?event=evt-harbour');
    });

    it('keeps the recorded figures one click away', async () => {
        respond();
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'See the numbers' }));
        expect(await screen.findByText('Paid revenue')).toBeInTheDocument();
        expect(screen.getByLabelText('Revenue currency')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Hide the numbers' }));
        expect(screen.queryByText('Paid revenue')).not.toBeInTheDocument();
    });

    it('lets Moose answer a follow-up from the same figures', async () => {
        respond();
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Which tickets are selling?' }));
        expect(await screen.findByText(/VIP Deck is sold out \(260\)\. General Admission has sold 1,576 of 2,200\./)).toBeInTheDocument();
    });

    it('turns into the door view while the event is live', async () => {
        respond({ stats: { ticketsSold: 354, ticketsUsed: 213 } });
        show({ event: { ...event, capacity: 440, startDatetime: iso(NOW - 3600000), endDatetime: iso(NOW + 3 * 3600000) } });
        expect(await screen.findByTestId('pulse-verdict')).toHaveTextContent('Doors open');
        expect(screen.getByTestId('moose-read')).toHaveTextContent('Doors are open. 213 of 354 ticket holders are in so far.');
        expect(screen.getByTestId('pulse-bar')).toHaveTextContent('213 of 354 ticket holders are in');
        expect(screen.queryByTestId('pulse-usual-marker')).not.toBeInTheDocument();
        expect(screen.getByTestId('vital-sign-sales')).toHaveTextContent('86 tickets left for walk-ups');
    });

    it('asks different questions once the show is over', async () => {
        respond({ stats: { ticketsSold: 322, ticketsUsed: 291 } });
        show({ event: { ...event, status: 'COMPLETED', capacity: 340, startDatetime: iso(NOW - 9 * DAY), endDatetime: iso(NOW - 9 * DAY + 3 * 3600000) } });
        expect(await screen.findByTestId('pulse-verdict')).toHaveTextContent('Wrapped');
        expect(screen.getByTestId('vital-sign-sales')).toHaveTextContent('95% sold');
        expect(screen.getByTestId('vital-sign-turnout')).toHaveTextContent('90% turned up');
        expect(screen.queryByTestId('vital-sign-safety')).not.toBeInTheDocument();
        expect(screen.queryByTestId('moose-ticket-tip')).not.toBeInTheDocument();
    });

    it('does not draw a sales bar before tickets are on sale', async () => {
        respond({ stats: { ticketsSold: 0, ticketsUsed: 0 } });
        mocks.get.mockImplementation((url) => {
            if (url === '/analytics/sales') return Promise.resolve(wrapped({ totalRevenue: 0, totalOrders: 0, salesByDay: [] }));
            if (String(url).endsWith('/stats')) return Promise.resolve(wrapped({ ticketsSold: 0, ticketsUsed: 0 }));
            return Promise.resolve({ data: [] });
        });
        show({ event: { ...event, name: 'Winter Lanterns Gala', status: 'PUBLISHED', capacity: 420, salesStart: iso(NOW + 10 * DAY), startDatetime: iso(NOW + 75 * DAY), endDatetime: iso(NOW + 75 * DAY + 5 * 3600000) } });
        expect(await screen.findByTestId('pulse-verdict')).toHaveTextContent('Not on sale yet');
        expect(screen.getByTestId('pulse-countdown')).toHaveTextContent('10days until on sale');
        expect(screen.queryByTestId('pulse-bar')).not.toBeInTheDocument();
        expect(screen.getByTestId('moose-read')).toHaveTextContent('Winter Lanterns Gala goes on sale in 10 days.');
    });

    it('falls back to the recorded overview and its alert when the pulse cannot load', async () => {
        mocks.get.mockRejectedValue(new Error('Offline'));
        show();
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.queryByTestId('pulse-verdict')).not.toBeInTheDocument();
    });

    it('leaves events sold on Showpass on the recorded overview', async () => {
        mocks.get.mockImplementation((url) => (String(url).includes('sold-counts') ? Promise.resolve(wrapped([{ eventId: 'evt-harbour', soldCount: 123 }])) : Promise.reject(new Error(`unexpected ${url}`))));
        show({ event: { ...event, organizationId: 'org-1', ticketingMode: 'EXTERNAL', externalPurchaseUrl: 'https://www.showpass.com/x/' } });
        expect(await screen.findByText('Sold on Showpass: 123')).toBeInTheDocument();
        expect(screen.queryByTestId('pulse-verdict')).not.toBeInTheDocument();
        expect(mocks.get.mock.calls.some(([url]) => url === '/analytics/sales')).toBe(false);
    });
});
