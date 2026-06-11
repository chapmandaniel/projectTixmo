import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TicketBuilder from '../components/TicketBuilder';

const ticketWithTier = {
    id: 'ticket-type-1',
    name: 'General Admission',
    price: '40',
    quantity: '100',
    status: 'ACTIVE',
    tiers: [
        {
            id: 'tier-1',
            name: 'Early Bird',
            price: '25',
            quantityLimit: '50',
            startsAt: '',
            endsAt: '',
        },
    ],
};

describe('TicketBuilder', () => {
    it('updates pricing tier fields in ticket state', () => {
        const onChange = vi.fn();

        render(
            <TicketBuilder
                tickets={[ticketWithTier]}
                onChange={onChange}
                onTierDelete={vi.fn()}
                isDark
            />
        );

        fireEvent.click(screen.getByText('Manage Tiers'));
        fireEvent.change(screen.getByLabelText('Early Bird price'), {
            target: { value: '30' },
        });

        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({
                id: 'ticket-type-1',
                tiers: [
                    expect.objectContaining({
                        id: 'tier-1',
                        price: '30',
                    }),
                ],
            }),
        ]);
    });

    it('reports persisted pricing tier deletes for API persistence', () => {
        const onChange = vi.fn();
        const onTierDelete = vi.fn();

        render(
            <TicketBuilder
                tickets={[ticketWithTier]}
                onChange={onChange}
                onTierDelete={onTierDelete}
                isDark
            />
        );

        fireEvent.click(screen.getByText('Manage Tiers'));
        fireEvent.click(screen.getByLabelText('Remove Early Bird'));

        expect(onTierDelete).toHaveBeenCalledWith('tier-1');
        expect(onChange).toHaveBeenCalledWith([
            expect.objectContaining({
                id: 'ticket-type-1',
                tiers: [],
            }),
        ]);
    });
});
