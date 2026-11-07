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
    currency: 'EUR',
    startDatetime: '2027-01-30T17:15:00.000Z',
    endDatetime: '2027-01-30T20:15:00.000Z',
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
        expect(screen.getByRole('heading', { name: 'Tickets on sale at Showpass' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Get your tickets' })).not.toBeInTheDocument();
        expect(screen.queryByText('Tickets unavailable')).not.toBeInTheDocument();
        const links = screen.getAllByRole('link', { name: 'Buy tickets on Showpass' });
        expect(links.length).toBeGreaterThan(0);
        expect(links.every((link) => link.getAttribute('href') === event.externalPurchaseUrl)).toBe(true);
        expect(screen.queryByRole('button', { name: /Continue to checkout/ })).not.toBeInTheDocument();
        expect(screen.queryByText('Select your tickets')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Choose tickets/ })).not.toBeInTheDocument();
        expect(screen.getAllByText(/Europe\/Dublin/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/\bUTC\b/)).not.toBeInTheDocument();
        expect(screen.getByText('Prices on Showpass are in EUR.')).toBeInTheDocument();
        expect(screen.queryByText(/CA\$/)).not.toBeInTheDocument();
    });

    it('shows an ended Showpass event as ended instead of the external sale', () => {
        render(
            <MemoryRouter>
                <EventOnSaleView
                    event={{
                        ...event,
                        ended: true,
                        startDatetime: '2020-01-30T17:15:00.000Z',
                        endDatetime: '2020-01-30T20:15:00.000Z',
                        ticketTypes: [{
                            id: 'ga',
                            name: 'General admission',
                            price: '35',
                            quantityAvailable: 4,
                            maxPerOrder: 4,
                            salesStart: '2099-11-01T00:00:00Z',
                        }],
                    }}
                />
            </MemoryRouter>
        );
        expect(screen.getByRole('heading', { name: 'This event has ended' })).toBeInTheDocument();
        expect(screen.getByText('Ticket sales are closed. Tickets you already bought are in My tickets.')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Tickets on sale at Showpass' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Buy tickets on Showpass' })).not.toBeInTheDocument();
        expect(screen.queryByText('On sale soon')).not.toBeInTheDocument();
        expect(screen.queryByRole('timer')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Continue to checkout' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Choose tickets' })).not.toBeInTheDocument();
        expect(screen.queryByText('Price includes HST and all fees.')).not.toBeInTheDocument();
        expect(screen.queryByText('Prices on Showpass are in EUR.')).not.toBeInTheDocument();
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
