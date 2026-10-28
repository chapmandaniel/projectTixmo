import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TicketTypeModal from '../features/TicketTypeModal';

const api = vi.hoisted(() => ({ put: vi.fn(), post: vi.fn(), get: vi.fn() }));
vi.mock('../lib/api', () => ({ default: api }));

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

    it('saves an unchanged Newfoundland sales window and only offers real statuses', async () => {
        api.put.mockResolvedValue({});
        const salesStart = '2026-01-15T22:30:45.000Z';
        const salesEnd = '2026-07-15T21:30:45.123Z';
        render(<TicketTypeModal
            isOpen
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            eventId="event-1"
            timeZone="America/St_Johns"
            isDark={false}
            initialData={{
                id: 'tt-general',
                name: 'General Admission',
                price: 25,
                quantityTotal: 100,
                salesStart,
                salesEnd,
                status: 'HIDDEN',
            }}
        />);
        expect(screen.getByDisplayValue('2026-01-15T19:00')).toBeInTheDocument();
        expect(screen.getByDisplayValue('2026-07-15T19:00')).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Hidden (Not visible)' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'Paused' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
        await waitFor(() => expect(api.put).toHaveBeenCalledWith('/ticket-types/tt-general', expect.objectContaining({
            status: 'HIDDEN',
            salesStart,
            salesEnd,
        })));
    });
});
