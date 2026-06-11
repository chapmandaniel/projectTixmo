import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsView from '../features/AnalyticsView';

const apiGet = vi.fn();
const apiPut = vi.fn();

vi.mock('../lib/api', () => ({
    default: {
        get: (...args) => apiGet(...args),
        put: (...args) => apiPut(...args),
    },
}));

vi.mock('@nivo/line', () => ({
    ResponsiveLine: () => <div data-testid="line-chart" />,
}));

vi.mock('@nivo/pie', () => ({
    ResponsivePie: () => <div data-testid="pie-chart" />,
}));

vi.mock('@nivo/bar', () => ({
    ResponsiveBar: () => <div data-testid="bar-chart" />,
}));

vi.mock('@nivo/heatmap', () => ({
    ResponsiveHeatMap: () => <div data-testid="heatmap-chart" />,
}));

describe('AnalyticsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGet.mockImplementation((url) => {
            if (url.startsWith('/events')) {
                return Promise.resolve({
                    data: {
                        events: [
                            { id: 'event-1', name: 'Neon Nights', status: 'ON_SALE' },
                        ],
                    },
                });
            }

            if (url.startsWith('/analytics/sales')) {
                return Promise.resolve({
                    data: {
                        totalRevenue: 12400,
                        totalOrders: 4,
                        totalTicketsSold: 8,
                        averageOrderValue: 3100,
                        salesByDay: [
                            { date: '2026-06-01', revenue: 12400, orders: 4, tickets: 8 },
                        ],
                        salesByEvent: [
                            { eventId: 'event-1', name: 'Neon Nights', revenue: 12400, orders: 4, ticketsSold: 8 },
                        ],
                    },
                });
            }

            if (url.startsWith('/analytics/events')) {
                return Promise.resolve({
                    data: {
                        topEvents: [
                            { id: 'event-1', name: 'Neon Nights', revenue: 12400, ticketsSold: 8 },
                        ],
                    },
                });
            }

            if (url.startsWith('/analytics/customers')) {
                return Promise.resolve({
                    data: {
                        totalCustomers: 3,
                        repeatCustomers: 1,
                        customersByRegistrationDate: [
                            { date: '2026-06-01', count: 3 },
                        ],
                    },
                });
            }

            if (url === '/organizations/org-1') {
                return Promise.resolve({
                    data: {
                        id: 'org-1',
                        name: 'Mighty Quinton',
                        settings: {
                            googleAnalyticsTags: [
                                { id: 'tag-1', title: 'Festival web tag', measurementId: 'G-TEST1234' },
                            ],
                            selectedGoogleAnalyticsTagId: 'tag-1',
                        },
                    },
                });
            }

            return Promise.resolve({ data: {} });
        });
    });

    it('separates GA4 traffic language from Tixmo sales language', async () => {
        render(
            <MemoryRouter>
                <AnalyticsView isDark user={{ organizationId: 'org-1' }} />
            </MemoryRouter>
        );

        expect(await screen.findByRole('heading', { name: 'Web traffic (GA4)' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Ticket sales (Tixmo data)' })).toBeInTheDocument();
        expect(screen.getByText('Visitor, session, page-view, channel, and device metrics come from the selected Google Analytics tag.')).toBeInTheDocument();
        expect(screen.getByText('Revenue, orders, tickets, customers, and purchase timing come from Tixmo orders and event records.')).toBeInTheDocument();
        expect(screen.getByText('GA4 web metrics only')).toBeInTheDocument();
        expect(screen.getByText('All Tixmo events')).toBeInTheDocument();
    });
});
