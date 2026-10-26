import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderDetailModal from '../features/OrderDetailModal';

const mocks = vi.hoisted(() => ({ post: vi.fn(), getStoredUser: vi.fn() }));
vi.mock('../lib/api', () => ({ default: { post: mocks.post, get: vi.fn() } }));
vi.mock('../lib/session', () => ({ getStoredUser: mocks.getStoredUser }));

const order = {
    id: 'order-1',
    orderNumber: 'A-1',
    status: 'PAID',
    paymentStatus: 'SUCCEEDED',
    refundStatus: 'NONE',
    totalAmount: 20,
    currency: 'cad',
    createdAt: '2026-10-26T12:00:00Z',
    user: { firstName: 'Ada', lastName: 'Buyer', email: 'ada@test.invalid' },
    event: { name: 'Show', venue: { name: 'Hall' } },
    tickets: [{ id: 'ticket-1', status: 'VALID', pricePaid: 20, ticketType: { name: 'GA' }, barcode: 'BAR' }],
    receiptDisclosure: {},
};

describe('staff void button', () => {
    beforeEach(() => {
        mocks.post.mockReset();
        mocks.getStoredUser.mockReset();
    });

    it('hides void from a promoter and posts a required reason for a manager', async () => {
        mocks.getStoredUser.mockReturnValue({ role: 'PROMOTER' });
        const { rerender } = render(<OrderDetailModal order={order} isDark={false} onClose={() => {}} onOrderUpdated={() => {}} />);
        expect(screen.queryByRole('button', { name: 'Void all tickets' })).not.toBeInTheDocument();

        mocks.getStoredUser.mockReturnValue({ role: 'MANAGER' });
        rerender(<OrderDetailModal order={order} isDark={false} onClose={() => {}} onOrderUpdated={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Void all tickets' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('A reason is required.');
        expect(mocks.post).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText('Void reason'), { target: { value: 'duplicate wristband' } });
        mocks.post.mockResolvedValue({ data: { data: order } });
        fireEvent.click(screen.getByRole('button', { name: 'Void GA' }));
        expect(mocks.post).toHaveBeenCalledWith('/orders/order-1/void', {
            reason: 'duplicate wristband',
            ticketId: 'ticket-1',
        });
    });

    it('shows a disputed order without offering to restore it', () => {
        mocks.getStoredUser.mockReturnValue({ role: 'ADMIN' });
        render(<OrderDetailModal order={{ ...order, refundStatus: 'DISPUTE_WON', tickets: [{ ...order.tickets[0], status: 'CANCELLED' }] }} isDark={false} onClose={() => {}} />);
        expect(screen.getByText('DISPUTED')).toBeInTheDocument();
        expect(screen.getByText(/won dispute does not restore/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Void all tickets' })).not.toBeInTheDocument();
    });
});
