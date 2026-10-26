import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderDetailModal from '../features/OrderDetailModal';

vi.mock('../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const rawBarcode = 'TIX-RAW-SECRET-9999';
const roles = ['OWNER', 'ADMIN', 'MANAGER', 'PROMOTER', 'TEAM_MEMBER', 'SCANNER', 'CUSTOMER'];
const emailRoles = new Set(['OWNER', 'ADMIN', 'MANAGER']);

const orderFor = (role) => ({
    id: 'order-1',
    orderNumber: 'ORD-1',
    status: 'PAID',
    paymentStatus: 'SUCCEEDED',
    createdAt: '2026-10-26T12:13:06.879Z',
    totalAmount: 10,
    currency: 'cad',
    refundStatus: 'NONE',
    user: {
        firstName: 'Ada',
        lastName: 'Buyer',
        ...(emailRoles.has(role) ? { email: 'buyer@example.com' } : {}),
    },
    event: { name: 'QA Show', venue: { name: 'Hall', address: '1 Gate' } },
    tickets: [{ id: 'ticket-1', pricePaid: '10', barcode: rawBarcode, ticketType: { name: 'QA GA (test)' } }],
});

describe('staff order detail trimmed fields', () => {
    it.each(roles)('%s sees a masked barcode and email only when the API includes it', (role) => {
        render(<OrderDetailModal order={orderFor(role)} isDark onClose={() => {}} onOrderUpdated={() => {}} />);
        expect(screen.getByText('Barcode: ••••9999')).toBeInTheDocument();
        expect(screen.getAllByText('$10.00').length).toBeGreaterThan(0);
        expect(screen.queryByText(rawBarcode)).not.toBeInTheDocument();
        expect(screen.queryByText(/Generating/)).not.toBeInTheDocument();
        if (emailRoles.has(role)) {
            expect(screen.getByText('buyer@example.com')).toBeInTheDocument();
        } else {
            expect(screen.queryByText('buyer@example.com')).not.toBeInTheDocument();
            expect(screen.queryByText('Email')).not.toBeInTheDocument();
        }
    });

    it('omits the barcode line when the API does not send one', () => {
        const order = orderFor('ADMIN');
        order.tickets[0].barcode = '';
        render(<OrderDetailModal order={order} isDark onClose={() => {}} onOrderUpdated={() => {}} />);
        expect(screen.queryByText(/Barcode:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Generating/)).not.toBeInTheDocument();
        expect(screen.getAllByText('$10.00').length).toBeGreaterThan(0);
    });
});
