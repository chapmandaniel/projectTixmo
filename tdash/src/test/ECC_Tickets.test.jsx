import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ECC_Tickets from '../features/ECC_Tickets';

const mocks = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../lib/api', () => ({ default: mocks }));

const event = { id: 'event-1' };
const general = {
    id: 'tt-general',
    name: 'General Admission',
    price: '25.00',
    quantitySold: 30,
    quantityTotal: 100,
    quantityAvailable: 70,
    status: 'ACTIVE',
};

describe('ticket class sold count', () => {
    it('shows quantitySold and quantityTotal when the API omits sold and quantity', async () => {
        mocks.get.mockResolvedValue({ data: { data: [general, {
            id: 'tt-vip', name: 'VIP', price: 80, quantitySold: 0, quantityTotal: 40, status: 'ACTIVE',
        }] } });
        render(<ECC_Tickets event={event} isDark />);
        const sold = await screen.findByText('30 / 100');
        expect(screen.getByText('0 / 40')).toBeInTheDocument();
        expect(screen.queryByText(/^0 \/ $/)).not.toBeInTheDocument();
        expect(sold.parentElement.querySelector('[style]')).toHaveStyle({ width: '30%' });
        expect(mocks.get).toHaveBeenCalledWith('/ticket-types?eventId=event-1&sortBy=price&sortOrder=asc');
    });
});
