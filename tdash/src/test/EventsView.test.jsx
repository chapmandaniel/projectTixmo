import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventsView from '../features/EventsView';

const apiGet = vi.fn();
const apiPost = vi.fn();
const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => navigate,
    };
});

vi.mock('../lib/api', () => ({
    default: {
        get: (...args) => apiGet(...args),
        post: (...args) => apiPost(...args),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    },
}));

vi.mock('../features/EventWizard', () => ({
    default: () => <div>Event Wizard</div>,
}));

vi.mock('../features/OrdersView', () => ({
    default: () => <div>Orders View</div>,
}));

vi.mock('../features/ScannersView', () => ({
    default: () => <div>Scanners View</div>,
}));

vi.mock('../features/VenuesView', () => ({
    default: () => <div>Venues View</div>,
}));

describe('EventsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        apiGet.mockImplementation((url) => {
            if (url.startsWith('/events')) {
                return Promise.resolve({
                    data: {
                        events: [
                            {
                                id: 'event-1',
                                title: 'Harbour Lights Festival',
                                status: 'PUBLISHED',
                                category: 'Festival',
                                startDateTime: '2026-04-20T20:00:00.000Z',
                                venue: { name: 'Harbour Hall' },
                                revenue: 12000,
                                capacity: 500,
                                sold: 260,
                            },
                            {
                                id: 'event-2',
                                title: 'Midnight Market',
                                status: 'ON_SALE',
                                category: 'Market',
                                startDateTime: '2026-05-02T19:00:00.000Z',
                                venue: { name: 'Warehouse 9' },
                                revenue: 8000,
                                capacity: 300,
                                sold: 190,
                            },
                            {
                                id: 'event-3',
                                title: 'Old Draft Show',
                                status: 'DRAFT',
                                category: 'Concert',
                                startDateTime: '2026-03-10T19:00:00.000Z',
                                venue: { name: 'Sunset Room' },
                                revenue: 0,
                                capacity: 200,
                                sold: 0,
                            },
                            {
                                id: 'event-4',
                                title: 'Cancelled Expo',
                                status: 'CANCELLED',
                                category: 'Expo',
                                startDateTime: '2026-04-22T19:00:00.000Z',
                                venue: { name: 'North Hall' },
                                revenue: 0,
                                capacity: 1000,
                                sold: 0,
                            },
                        ],
                    },
                });
            }

            if (url.startsWith('/orders')) {
                return Promise.resolve({
                    data: {
                        data: {
                            orders: new Array(12).fill({}),
                        },
                    },
                });
            }

            if (url.startsWith('/venues')) {
                return Promise.resolve({
                    data: {
                        data: {
                            venues: [{ id: 'venue-1' }, { id: 'venue-2' }],
                        },
                    },
                });
            }

            if (url.startsWith('/scanners')) {
                return Promise.resolve({
                    data: {
                        data: {
                            scanners: [{ id: 'scanner-1' }],
                        },
                    },
                });
            }

            return Promise.resolve({ data: {} });
        });
    });

    it('renders home-style tool cards with an active events rail and navigates into an event', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <EventsView isDark user={{ role: 'ADMIN' }} />
                </MemoryRouter>
            );
        });

        await waitFor(() => expect(screen.getByText('Harbour Lights Festival')).toBeInTheDocument());

        expect(screen.queryByText('Tools')).not.toBeInTheDocument();
        expect(screen.queryByText('Choose the Event Manager workspace you want to use.')).not.toBeInTheDocument();
        expect(screen.getByText('Create New Event')).toBeInTheDocument();
        expect(screen.getByText('Event Library')).toBeInTheDocument();
        expect(screen.getByText('Current Events')).toBeInTheDocument();
        expect(screen.getByText('Midnight Market')).toBeInTheDocument();
        expect(screen.queryByText('Old Draft Show')).not.toBeInTheDocument();
        expect(screen.queryByText('Cancelled Expo')).not.toBeInTheDocument();
        expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
        expect(screen.queryByText('Sell-through')).not.toBeInTheDocument();
        expect(screen.queryByText('Enter event')).not.toBeInTheDocument();

        const activeEventsRail = screen.getByText('Current Events').closest('aside');
        expect(activeEventsRail).toHaveClass('flex', 'flex-col', 'p-6');
        const activeEventCard = screen.getByTestId('active-event-card-event-1');
        expect(activeEventCard.querySelector('[aria-hidden="true"]')).toBeNull();

        fireEvent.click(screen.getByText('Harbour Lights Festival').closest('button'));

        expect(navigate).toHaveBeenCalledWith('/events/harbour-lights-festival-event-1', {
            state: {
                event: expect.objectContaining({
                    id: 'event-1',
                    title: 'Harbour Lights Festival',
                }),
            },
        });
    });
});
