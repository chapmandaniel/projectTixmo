import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventOnSaleView } from '../pages/EventOnSalePage';
import EventCommandCenter from '../features/EventCommandCenter';

const event = {
    id: 'event-1',
    name: 'Pumpkins After Dark 2026',
    slug: 'pumpkins-after-dark-2026-6',
    status: 'PUBLISHED',
    timezone: 'Europe/Dublin',
    startDatetime: '2026-10-30T17:15:00.000Z',
    ticketingMode: 'EXTERNAL',
    externalPurchaseUrl: 'https://www.showpass.com/pumpkins-after-dark-2026-6/',
    ticketTypes: [],
    venue: { name: 'Newbridge House & Farm', address: { street: 'Hearse Rd', city: 'Donabate', state: 'County Dublin', country: 'IE', postalCode: 'K36 VR90' } },
};

describe('vendor-sold public event', () => {
    it('shows the Showpass buy link and hides checkout', () => {
        render(
            <MemoryRouter>
                <EventOnSaleView event={event} />
            </MemoryRouter>
        );
        const links = screen.getAllByRole('link', { name: 'Buy tickets on Showpass' });
        expect(links[0]).toHaveAttribute('href', event.externalPurchaseUrl);
        expect(screen.queryByRole('button', { name: /Continue to checkout/ })).not.toBeInTheDocument();
    });

    it('hides orders, attendees, tickets, and checkout in the event command center', () => {
        render(
            <MemoryRouter initialEntries={['/events/event-1/overview']}>
                <EventCommandCenter event={event} isDark user={{ id: 'owner', role: 'OWNER' }} />
            </MemoryRouter>
        );
        expect(screen.queryByRole('button', { name: 'Orders' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Attendees' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Tickets' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Buy on Showpass' })).toHaveAttribute('href', event.externalPurchaseUrl);
    });
});
