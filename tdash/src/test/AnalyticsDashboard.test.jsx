import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import AnalyticsDashboardApp from '../features/analyticsDashboard/AnalyticsDashboardApp';
import { EMPTY_STATE_MESSAGE } from '../features/analyticsDashboard/mockAnalytics';
import { formatChartHover } from '../features/analyticsDashboard/formatters';

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

vi.mock('@nivo/line', () => ({
    ResponsiveLine: () => <div data-testid="analytics-trend-chart" />,
}));

const BANNED = [
    /conversion rate/i,
    /sessions/i,
    /funnel/i,
    /attribution/i,
    /\bCTR\b/,
    /cohort/i,
    /median/i,
    /percentile/i,
    /GA4/,
];

const mount = (entry = '/analytics') => render(
    <MemoryRouter initialEntries={[entry]}>
        <Routes>
            <Route path="/analytics/*" element={<AnalyticsDashboardApp isDark basePath="/analytics" />} />
        </Routes>
    </MemoryRouter>
);

describe('Analytics dashboard prototype', () => {
    it('renders Home for one event on the default 28-day range', () => {
        mount('/analytics');

        expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
        expect(screen.getByText('Updated 5 min ago')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Last 28 days' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('analytics-event-select')).toHaveValue('evt-aurora');
        expect(screen.getByTestId('analytics-home-hero')).toBeInTheDocument();
        expect(screen.getByTestId('analytics-hero-chart')).toHaveClass('order-2', 'lg:order-1');
        expect(screen.getByTestId('analytics-hero-stats')).toHaveClass('order-1', 'lg:order-2');
        expect(within(screen.getByTestId('analytics-kpi-tickets')).getByText('Tickets sold')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-tickets')).getByText('412')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-revenue')).getByText('CA$18,540')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-visitors')).getByText('Event page visitors')).toBeInTheDocument();
        expect(screen.getByTestId('analytics-live-now')).toHaveTextContent('23 people on your event page right now');
        expect(screen.getByRole('heading', { name: 'What happened' })).toBeInTheDocument();
        expect(screen.getByText('Sales jumped Tuesday: most buyers came from Instagram after your lineup post.')).toBeInTheDocument();
        expect(screen.getByText('On pace to sell about 750 of 800 by show day.')).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Analytics dashboard' })).toHaveTextContent('Ticket path');
        expect(screen.getByRole('navigation', { name: 'Analytics dashboard' })).toHaveTextContent('Where buyers came from');
        expect(screen.queryByText(EMPTY_STATE_MESSAGE)).not.toBeInTheDocument();
        BANNED.forEach((pattern) => {
            expect(screen.queryByText(pattern)).not.toBeInTheDocument();
        });
    });

    it('changes the numbers and text when the event changes', () => {
        mount('/analytics');

        fireEvent.change(screen.getByTestId('analytics-event-select'), {
            target: { value: 'evt-harbour' },
        });

        expect(screen.getByTestId('analytics-event-select')).toHaveValue('evt-harbour');
        expect(within(screen.getByTestId('analytics-kpi-tickets')).getByText('1,246')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-tickets')).queryByText('412')).not.toBeInTheDocument();
        expect(screen.getByText('61 people on your event page right now')).toBeInTheDocument();
        expect(screen.getByText('Weekend pass sales led the week after you posted the Saturday lineup.')).toBeInTheDocument();
        expect(screen.getByText('On pace to sell about 1,800 of 2,500 by show day.')).toBeInTheDocument();
        expect(screen.queryByText('Sales jumped Tuesday: most buyers came from Instagram after your lineup post.')).not.toBeInTheDocument();
    });

    it('changes the numbers and text when the date range changes', () => {
        mount('/analytics');

        fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));

        expect(within(screen.getByTestId('analytics-kpi-tickets')).getByText('98')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-tickets')).queryByText('412')).not.toBeInTheDocument();
        expect(screen.getByText('This week is quieter than last week after Tuesday’s Instagram rush.')).toBeInTheDocument();
        expect(screen.getAllByText(/vs previous 7 days/).length).toBeGreaterThan(0);
        expect(screen.queryByText('Sales jumped Tuesday: most buyers came from Instagram after your lineup post.')).not.toBeInTheDocument();
    });

    it('shows the empty state for an event with no sales', () => {
        mount('/analytics');

        fireEvent.change(screen.getByTestId('analytics-event-select'), {
            target: { value: 'evt-quiet' },
        });

        expect(screen.getByText(EMPTY_STATE_MESSAGE)).toBeInTheDocument();
        expect(screen.queryByText('Tickets sold')).not.toBeInTheDocument();
        expect(screen.queryByText('23 people on your event page right now')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'What happened' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Heads up' })).not.toBeInTheDocument();
    });

    it('renders Ticket path and Where buyers came from', () => {
        mount('/analytics/ticket-path');
        expect(screen.getByRole('heading', { name: 'Ticket path' })).toBeInTheDocument();
        expect(screen.getByText('Viewed event page')).toBeInTheDocument();
        expect(screen.getByText('Picked tickets')).toBeInTheDocument();
        expect(screen.getByText('Started checkout')).toBeInTheDocument();
        expect(screen.getByText('Bought')).toBeInTheDocument();
        expect(screen.getByText("4 in 10 people who start checkout don't finish.")).toBeInTheDocument();

        mount('/analytics/where-buyers-came-from');
        expect(screen.getByRole('heading', { name: 'Where buyers came from' })).toBeInTheDocument();
        expect(screen.getByText('Instagram')).toBeInTheDocument();
        expect(screen.getByText('Facebook')).toBeInTheDocument();
        expect(screen.getByText('Google')).toBeInTheDocument();
        expect(screen.getByText('Email buyers spend the most. One more email this week could help.')).toBeInTheDocument();
        const channels = screen.getAllByTestId(/analytics-channel-(instagram|facebook|google|email|direct|other)/);
        expect(channels[0]).toHaveAttribute('data-testid', 'analytics-channel-instagram');
        const ticketCounts = channels.map((card) => {
            const ticketsRow = within(card).getByText('Tickets').parentElement;
            return Number(ticketsRow.textContent.replace(/Tickets/g, '').replace(/,/g, '').trim());
        });
        expect([...ticketCounts].sort((left, right) => right - left)).toEqual(ticketCounts);
        BANNED.forEach((pattern) => {
            expect(screen.queryByText(pattern)).not.toBeInTheDocument();
        });
    });

    it('writes a plain-language hover line for a day on the chart', () => {
        expect(formatChartHover({ date: '2026-11-04', tickets: 86, visitors: 1240 })).toBe(
            'Wed Nov 4: 86 tickets sold, 1,240 people visited'
        );
        expect(formatChartHover({ date: '2026-11-18', forecast: 14 })).toBe(
            'Wed Nov 18: on pace for about 14 tickets'
        );
    });
});
