import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrdersView from '../features/OrdersView';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../lib/api', () => ({ default: mocks }));

const orderId = '6d93afd3-0000-4000-8000-000000000001';
const rawBarcode = 'TIX-SECRET-SHOULD-NOT-RENDER';
const listOrder = {
    id: orderId,
    orderNumber: 'ORD-7344',
    totalAmount: 20,
    currency: 'cad',
    status: 'PAID',
    paymentStatus: 'SUCCEEDED',
    createdAt: '2026-10-26T12:13:06.879Z',
    user: { firstName: 'Ada', lastName: 'Buyer', email: 'buyer@example.com' },
    event: { id: 'event-1', name: 'QA STAGING TEST' },
    tickets: [
        { id: 'ticket-1', ticketType: { name: 'QA GA (test)' } },
        { id: 'ticket-2', ticketType: { name: 'QA GA (test)' } },
    ],
};
const detailOrder = {
    ...listOrder,
    tickets: listOrder.tickets.map((ticket) => ({
        ...ticket,
        pricePaid: '10',
        barcode: rawBarcode,
    })),
};

const eventFetches = () => mocks.get.mock.calls.filter(([url]) => url === '/events?limit=100').length;

beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation((url) => {
        if (url === '/events?limit=100') {
            return Promise.resolve({ data: { data: { events: [{ id: 'event-1', title: 'QA STAGING TEST' }] } } });
        }
        if (url === `/orders/${orderId}`) {
            return Promise.resolve({ data: { success: true, data: detailOrder } });
        }
        return Promise.resolve({
            data: { success: true, data: { orders: [listOrder], pagination: { pages: 1 } } },
        });
    });
    mocks.post.mockResolvedValue({ data: { success: true, data: { status: 'REFUNDED' } } });
});

describe('OrdersView staff refunds', () => {
    it('fetches the event list once and sends the refund with the API error', async () => {
        mocks.post.mockRejectedValue({
            response: { data: { message: 'Full refunds require unused, untransferred tickets' } },
        });
        const view = render(<OrdersView isDark />);
        expect(await screen.findByText('ORD-7344')).toBeInTheDocument();
        await waitFor(() => expect(eventFetches()).toBe(1));

        for (let renderCount = 0; renderCount < 5; renderCount += 1) {
            view.rerender(<OrdersView isDark eventOptions={[]} />);
        }
        await waitFor(() => expect(eventFetches()).toBe(1));

        fireEvent.click(screen.getByRole('button', { name: 'View order ORD-7344' }));
        expect(await screen.findAllByText('$10.00')).toHaveLength(2);
        expect(screen.getAllByText('Barcode: Issued')).toHaveLength(2);
        expect(screen.queryByText(/Generating/)).not.toBeInTheDocument();
        expect(screen.queryByText(rawBarcode)).not.toBeInTheDocument();
        expect(screen.getAllByText('$20.00').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: 'Refund Order' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm full refund' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Full refunds require unused, untransferred tickets');
        expect(screen.queryByText('Failed to refund order')).not.toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post).toHaveBeenCalledWith(`/orders/${orderId}/refund`);
        expect(eventFetches()).toBe(1);
    });

    it('does not request events when the parent already supplied them', async () => {
        render(<OrdersView isDark eventOptions={[{ id: 'event-9', title: 'Embedded night' }]} />);
        expect(await screen.findByText('ORD-7344')).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Embedded night' })).toBeInTheDocument();
        expect(eventFetches()).toBe(0);
    });
});
