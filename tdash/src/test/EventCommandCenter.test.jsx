import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EventCommandCenter from '../features/EventCommandCenter';

vi.mock('../features/ECC_Overview', () => ({
    default: ({ event }) => <div>Overview for {event.name}</div>,
}));

vi.mock('../features/ECC_Orders', () => ({
    default: () => <div>Orders panel</div>,
}));

vi.mock('../features/ECC_Attendees', () => ({
    default: () => <div>Attendees panel</div>,
}));

vi.mock('../features/ECC_Tickets', () => ({
    default: () => <div>Tickets panel</div>,
}));

vi.mock('../features/ECC_Settings', () => ({
    default: () => <div>Settings panel</div>,
}));

vi.mock('../features/EventStudio', () => ({
    default: () => <div>Event Studio</div>,
}));

const baseEvent = {
    id: 'event-1',
    name: 'Harborlight Summer Session',
    slug: 'market-demo-harborlight-summer-session',
    status: 'ON_SALE',
    startDateTime: '2026-07-03T22:30:00.000Z',
    venue: { name: 'Pier 17 Rooftop' },
};

const renderCommandCenter = (event = baseEvent) => render(
    <MemoryRouter initialEntries={[`/events/${event.slug || event.id}`]}>
        <Routes>
            <Route
                path="/events/:eventId/*"
                element={(
                    <EventCommandCenter
                        event={event}
                        onBack={vi.fn()}
                        isDark
                        user={{ role: 'ADMIN' }}
                        onUpdate={vi.fn()}
                    />
                )}
            />
        </Routes>
    </MemoryRouter>
);

describe('EventCommandCenter checkout links', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
        vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    it('copies and opens the buyer checkout link for on-sale events', async () => {
        renderCommandCenter();

        const expectedUrl = 'http://localhost:3000/checkout/market-demo-harborlight-summer-session';

        fireEvent.click(screen.getByRole('button', { name: 'Copy checkout link' }));

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedUrl);
        });
        expect(screen.getByText('Checkout link copied')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^Checkout$/ }));

        expect(window.open).toHaveBeenCalledWith(expectedUrl, '_blank', 'noopener,noreferrer');
    });

    it('disables checkout link actions for draft events', () => {
        renderCommandCenter({
            ...baseEvent,
            status: 'DRAFT',
        });

        expect(screen.getByRole('button', { name: 'Copy checkout link' })).toBeDisabled();
        expect(screen.getByRole('button', { name: /^Checkout$/ })).toBeDisabled();
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
});
