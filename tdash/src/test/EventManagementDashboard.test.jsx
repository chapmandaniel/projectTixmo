import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import EventManagementDashboard from '../features/EventManagementDashboard';
import { generateEventSlug } from '../lib/utils';

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();

vi.mock('../lib/api', () => ({
    default: {
        get: (...args) => apiGet(...args),
        put: (...args) => apiPut(...args),
        post: (...args) => apiPost(...args),
        delete: (...args) => apiDelete(...args),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}));

vi.mock('../features/ECC_Overview', () => ({
    default: ({ event }) => <div>Overview for {event.name || event.title}</div>,
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

vi.mock('../features/EventSalesControl', () => ({
    default: ({ onUpdate, event }) => (
        <div>
            <button type="button" onClick={() => onUpdate?.({ ...event, name: 'Updated Harborlight' })}>
                Apply event update
            </button>
            <button type="button" onClick={() => onUpdate?.()}>
                Refresh event
            </button>
        </div>
    ),
}));

const EVENT_ID = '10000000-0000-4000-8000-000000000001';
const TICKET_TYPE_ID = '10000000-0000-4000-8000-000000000002';

const fakeEvent = {
    id: EVENT_ID,
    name: 'Harborlight Summer Session',
    title: 'Harborlight Summer Session',
    slug: 'harborlight-summer-session',
    status: 'ON_SALE',
    startDateTime: '2026-07-03T22:30:00.000Z',
    endDateTime: '2026-07-04T02:00:00.000Z',
    timezone: 'America/St_Johns',
    venueId: 'venue-1',
    venue: { name: 'Pier 17 Rooftop' },
    capacity: 100,
    category: 'Music',
    description: 'Waterfront session.',
};

const eventSlug = generateEventSlug(fakeEvent.name, fakeEvent.id);
const owner = { id: 'owner-1', role: 'OWNER', organizationId: 'org-1' };

const LocationProbe = () => {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
};

const renderDashboard = (path, state) => render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <Routes>
            <Route path="/events/:eventId/*" element={<EventManagementDashboard isDark user={owner} />} />
            <Route path="/events" element={<div>Events list</div>} />
        </Routes>
        <LocationProbe />
    </MemoryRouter>
);

const mockEventFetch = (event = fakeEvent) => {
    apiGet.mockImplementation((url) => {
        const path = String(url);
        if (path.startsWith('/venues')) {
            return Promise.resolve({ data: { data: { venues: [{ id: 'venue-1', name: 'Pier 17 Rooftop' }] } } });
        }
        if (path.startsWith('/ticket-types')) {
            return Promise.resolve({
                data: {
                    data: {
                        ticketTypes: [{
                            id: TICKET_TYPE_ID,
                            name: 'General Admission',
                            price: 25,
                            quantityTotal: 100,
                            tiers: [],
                        }],
                    },
                },
            });
        }
        if (path.startsWith(`/events/${EVENT_ID}`)) {
            return Promise.resolve({ data: { data: event } });
        }
        return Promise.resolve({ data: { data: {} } });
    });
};

describe('EventManagementDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockEventFetch();
        apiPut.mockResolvedValue({ data: { data: fakeEvent } });
        apiDelete.mockResolvedValue({ data: { success: true } });
        Object.assign(navigator, {
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
        vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows a loading spinner until a valid event fetch resolves', async () => {
        let resolveEvent;
        apiGet.mockImplementation((url) => {
            if (String(url).startsWith(`/events/${EVENT_ID}`)) {
                return new Promise((resolve) => {
                    resolveEvent = resolve;
                });
            }
            return Promise.resolve({ data: { data: {} } });
        });

        renderDashboard(`/events/${eventSlug}`);

        expect(document.querySelector('.animate-spin')).toBeTruthy();
        expect(apiGet).toHaveBeenCalledWith(`/events/${EVENT_ID}`);

        await act(async () => {
            resolveEvent({ data: { data: fakeEvent } });
        });

        expect(await screen.findByText(fakeEvent.name)).toBeInTheDocument();
        expect(screen.getByText(`Overview for ${fakeEvent.name}`)).toBeInTheDocument();
        expect(document.querySelector('.animate-spin')).toBeFalsy();
    });

    it('renders immediately from router state without fetching the event', async () => {
        renderDashboard(`/events/${eventSlug}`, { event: fakeEvent });

        expect(await screen.findByText(fakeEvent.name)).toBeInTheDocument();
        expect(apiGet.mock.calls.some(([url]) => String(url).startsWith('/events/'))).toBe(false);
    });

    it('accepts an event nested under data.event', async () => {
        apiGet.mockImplementation((url) => {
            if (String(url).startsWith(`/events/${EVENT_ID}`)) {
                return Promise.resolve({ data: { event: fakeEvent } });
            }
            return Promise.resolve({ data: { data: {} } });
        });

        renderDashboard(`/events/${eventSlug}`);

        expect(await screen.findByText(fakeEvent.name)).toBeInTheDocument();
        expect(apiGet).toHaveBeenCalledWith(`/events/${EVENT_ID}`);
    });

    it('lets the operator retry after a fetch error', async () => {
        apiGet.mockRejectedValue({ response: { status: 500, data: { message: 'Unavailable' } } });

        renderDashboard(`/events/${eventSlug}`);

        expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i);
        expect(screen.queryByText('Events list')).not.toBeInTheDocument();

        mockEventFetch();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText(fakeEvent.name)).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('returns to /events from the fetch-error back control', async () => {
        apiGet.mockRejectedValue({ response: { status: 500, data: { message: 'Unavailable' } } });

        renderDashboard(`/events/${eventSlug}`);

        expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i);
        fireEvent.click(screen.getByRole('button', { name: 'Back to events' }));
        expect(screen.getByText('Events list')).toBeInTheDocument();
    });

    it('sends the operator back to /events when the payload has no event id', async () => {
        apiGet.mockResolvedValue({ data: { data: { name: 'Broken payload' } } });

        renderDashboard(`/events/${eventSlug}`);

        expect(await screen.findByText('Events list')).toBeInTheDocument();
        expect(screen.queryByText('Broken payload')).not.toBeInTheDocument();
    });

    it('shows a fetch error instead of silently leaving the event dashboard', async () => {
        apiGet.mockRejectedValue({ response: { status: 500, data: { message: 'Unavailable' } } });
        renderDashboard(`/events/${eventSlug}`);
        expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i);
        expect(screen.queryByText('Events list')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Back to events' })).toBeInTheDocument();
    });

    it('navigates between command-center tabs', async () => {
        renderDashboard(`/events/${eventSlug}`, { event: fakeEvent });
        await screen.findByText(fakeEvent.name);

        expect(screen.getByText(`Overview for ${fakeEvent.name}`)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Orders' }));
        expect(screen.getByText('Orders panel')).toBeInTheDocument();
        expect(screen.getByTestId('location')).toHaveTextContent(`/events/${eventSlug}/orders`);

        fireEvent.click(screen.getByRole('button', { name: 'Attendees' }));
        expect(screen.getByText('Attendees panel')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Tickets' }));
        expect(screen.getByText('Tickets panel')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        expect(screen.getByText('Event Settings')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
        expect(screen.getByText(`Overview for ${fakeEvent.name}`)).toBeInTheDocument();
    });

    it('opens a nested event route on the matching tab', async () => {
        renderDashboard(`/events/${eventSlug}/tickets`, { event: fakeEvent });

        expect(await screen.findByText('Tickets panel')).toBeInTheDocument();
        expect(screen.queryByText(`Overview for ${fakeEvent.name}`)).not.toBeInTheDocument();
    });

    it('falls back to overview for an unknown sub-route', async () => {
        renderDashboard(`/events/${eventSlug}/not-a-tab`, { event: fakeEvent });

        expect(await screen.findByText(`Overview for ${fakeEvent.name}`)).toBeInTheDocument();
    });

    it('returns to the events list from the back control', async () => {
        renderDashboard(`/events/${eventSlug}`, { event: fakeEvent });
        await screen.findByText(fakeEvent.name);

        fireEvent.click(screen.getByTitle('Back to Dashboard'));

        expect(screen.getByText('Events list')).toBeInTheDocument();
    });

    it('renders a title-only router-state event from the events list payload', async () => {
        const titled = {
            id: EVENT_ID,
            title: 'Harbour Lights Festival',
            status: 'ON_SALE',
            venue: { name: 'Harbour Hall' },
        };
        renderDashboard(`/events/${EVENT_ID}`, { event: titled });

        expect(await screen.findByText('Harbour Lights Festival')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Orders' }));
        expect(screen.getByText('Orders panel')).toBeInTheDocument();
    });

    it('keeps the friendly slug when the event only has a title', async () => {
        const titled = {
            id: EVENT_ID,
            title: 'Harbour Lights Festival',
            status: 'ON_SALE',
            venue: { name: 'Harbour Hall' },
        };
        renderDashboard(`/events/${generateEventSlug(titled.title, titled.id)}`, { event: titled });
        await screen.findByText('Harbour Lights Festival');
        fireEvent.click(screen.getByRole('button', { name: 'Orders' }));
        expect(screen.getByTestId('location')).toHaveTextContent(
            `/events/${generateEventSlug(titled.title, titled.id)}/orders`
        );
    });

    it('applies an in-place event update from a child', async () => {
        renderDashboard(`/events/${eventSlug}`, { event: fakeEvent });
        await screen.findByText(fakeEvent.name);

        fireEvent.click(screen.getByRole('button', { name: 'Apply event update' }));

        expect(await screen.findByText('Updated Harborlight')).toBeInTheDocument();
        expect(apiGet.mock.calls.some(([url]) => String(url).startsWith('/events/'))).toBe(false);
    });

    it('refetches the event when a child update has no id', async () => {
        renderDashboard(`/events/${eventSlug}`, { event: fakeEvent });
        await screen.findByText(fakeEvent.name);

        mockEventFetch({ ...fakeEvent, name: 'Refetched Harborlight' });
        fireEvent.click(screen.getByRole('button', { name: 'Refresh event' }));

        expect(await screen.findByText('Refetched Harborlight')).toBeInTheDocument();
        expect(apiGet).toHaveBeenCalledWith(`/events/${EVENT_ID}`);
    });

    it('requires deletion confirmation on the settings tab', async () => {
        renderDashboard(`/events/${eventSlug}/settings`, { event: fakeEvent });
        await screen.findByText('Event Settings');

        fireEvent.click(screen.getByRole('button', { name: 'Delete Event' }));
        expect(apiDelete).not.toHaveBeenCalled();
        expect(screen.getByText(/Move “Harborlight Summer Session” to the recycle bin/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Keep event' }));
        expect(screen.queryByRole('button', { name: 'Confirm deletion' })).not.toBeInTheDocument();
        expect(apiDelete).not.toHaveBeenCalled();
    });

    it('surfaces Event Studio publish validation from the settings tab', async () => {
        renderDashboard(`/events/${eventSlug}/settings`, { event: fakeEvent });
        await screen.findByText('Event Settings');

        fireEvent.click(screen.getByRole('button', { name: 'Edit Event' }));
        const title = await screen.findByLabelText('Event Title');
        await screen.findAllByText('General Admission');

        fireEvent.change(title, { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Publish Event' }));

        expect(await screen.findByText(/Cannot Publish. Missing: Title/)).toBeInTheDocument();
        expect(apiPut).not.toHaveBeenCalled();
        expect(apiPost).not.toHaveBeenCalled();
    });

    it('keeps a settings deletion error on the event dashboard', async () => {
        apiDelete.mockRejectedValue({ response: { data: { message: 'Cannot delete event with existing tickets.' } } });
        renderDashboard(`/events/${eventSlug}/settings`, { event: fakeEvent });
        await screen.findByText('Event Settings');

        fireEvent.click(screen.getByRole('button', { name: 'Delete Event' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Cannot delete event with existing tickets.');
        await waitFor(() => expect(apiDelete).toHaveBeenCalledWith(`/events/${EVENT_ID}`));
        expect(screen.getAllByText(fakeEvent.name).length).toBeGreaterThan(0);
        expect(screen.queryByText('Events list')).not.toBeInTheDocument();
    });
});
