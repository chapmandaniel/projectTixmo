import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TicketTypeModal from '../features/TicketTypeModal';

describe('ticket type editor inventory', () => {
    it('fills total capacity from quantityTotal rather than remaining stock', async () => {
        render(<TicketTypeModal
            isOpen
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            eventId="event-1"
            isDark={false}
            initialData={{
                id: 'tt-general',
                name: 'General Admission',
                price: 25,
                quantitySold: 40,
                quantityTotal: 100,
                quantityAvailable: 60,
                status: 'ACTIVE',
            }}
        />);
        expect(await screen.findByDisplayValue('100')).toBeInTheDocument();
        expect(screen.getByText('Total quantity')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('60')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('40')).not.toBeInTheDocument();
    });
});
