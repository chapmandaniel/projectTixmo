import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import AnalyticsDashboardApp from '../features/analyticsDashboard/AnalyticsDashboardApp';
import {
    EMPTY_STATE_MESSAGE,
    GA4_SOURCES,
    selectAnalyticsDashboard,
} from '../features/analyticsDashboard/mockAnalytics';
import { adaptGa4Report, makeGa4Report } from '../features/analyticsDashboard/ga4Adapter';
import { formatChartHover, formatDuration } from '../features/analyticsDashboard/formatters';

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

vi.mock('@nivo/line', () => ({
    ResponsiveLine: () => <div data-testid="analytics-trend-chart" />,
}));

const GA_METRIC_NAMES = [
    /activeUsers/,
    /screenPageViews/,
    /averageSessionDuration/,
    /ecommercePurchases/,
    /purchaseRevenue/,
    /sessionDefaultChannelGroup/,
    /deviceCategory/,
    /pagePath/,
    /pageTitle/,
    /\bGA4\b/,
];

const TICKET_DB_COPY = [
    /Tickets sold/,
    /Event page visitors/,
    /people on your event page right now/,
    /Where buyers came from/,
];

const mount = (entry = '/analytics') => render(
    <MemoryRouter initialEntries={[entry]}>
        <Routes>
            <Route path="/analytics/*" element={<AnalyticsDashboardApp isDark />} />
        </Routes>
    </MemoryRouter>
);

describe('GA4 adapter', () => {
    it('shapes rows like a Data API runReport and adapts them into view models', () => {
        const report = makeGa4Report(
            ['date', 'pagePath'],
            ['activeUsers', 'screenPageViews'],
            [{ date: '20261104', pagePath: '/events/aurora-after-dark', activeUsers: 412, screenPageViews: 860 }]
        );

        expect(report).toEqual({
            dimensionHeaders: [{ name: 'date' }, { name: 'pagePath' }],
            metricHeaders: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
            rows: [{
                dimensionValues: [{ value: '20261104' }, { value: '/events/aurora-after-dark' }],
                metricValues: [{ value: '412' }, { value: '860' }],
            }],
            rowCount: 1,
        });
        expect(adaptGa4Report(report)).toEqual([{
            dimensions: { date: '20261104', pagePath: '/events/aurora-after-dark' },
            metrics: { activeUsers: 412, screenPageViews: 860 },
        }]);
        expect(adaptGa4Report(null)).toEqual([]);
    });

    it('keeps mock sources in the Data API shape', () => {
        const daily = GA4_SOURCES['aurora-after-dark'].daily;
        expect(daily.dimensionHeaders.map((header) => header.name)).toEqual(['date', 'pagePath']);
        expect(daily.metricHeaders.map((header) => header.name)).toEqual([
            'activeUsers',
            'screenPageViews',
            'averageSessionDuration',
            'ecommercePurchases',
            'purchaseRevenue',
        ]);
        expect(daily.rowCount).toBe(daily.rows.length);
        expect(daily.rows[0].dimensionValues[0]).toEqual({ value: expect.stringMatching(/^\d{8}$/) });
        expect(daily.rows[0].metricValues[0]).toEqual({ value: expect.stringMatching(/^\d/) });

        const realtime = GA4_SOURCES['aurora-after-dark'].realtime;
        expect(realtime.metricHeaders).toEqual([{ name: 'activeUsers' }]);
        expect(adaptGa4Report(realtime)[0].metrics.activeUsers).toBe(23);
    });
});

describe('Analytics dashboard prototype', () => {
    it('formats average time on site as minutes and seconds', () => {
        expect(formatDuration(102)).toBe('1m 42s');
        expect(formatDuration(90)).toBe('1m 30s');
        expect(formatDuration(0)).toBe('0m 0s');
    });

    it('renders a GA Home for one event page on the default 28-day range', () => {
        mount('/analytics');

        expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
        expect(screen.getByText('Site / event page')).toBeInTheDocument();
        expect(screen.getByLabelText('Site / event page')).toHaveValue('aurora-after-dark');
        expect(screen.getByRole('button', { name: 'Last 28 days' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('analytics-home-hero')).toBeInTheDocument();
        expect(screen.getByTestId('analytics-hero-chart')).toHaveClass('order-2', 'lg:order-1');
        expect(screen.getByTestId('analytics-hero-stats')).toHaveClass('order-1', 'lg:order-2');

        expect(within(screen.getByTestId('analytics-kpi-visitors')).getByText('Visitors')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-visitors')).getByText('1,180')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-pageviews')).getByText('Page views')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-pageviews')).getByText('2,460')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-time')).getByText('Avg time on site')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-time')).getByText('1m 42s')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-purchases')).getByText('Purchases')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-purchases')).getByText('118')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-purchases')).queryByText(/CA\$/)).not.toBeInTheDocument();

        expect(screen.getByTestId('analytics-live-now')).toHaveTextContent('23 people on your site right now');
        expect(screen.getByTestId('analytics-pace')).toHaveTextContent('Visitors are running 18% ahead of last period.');

        expect(screen.getByRole('heading', { name: 'Heads up' })).toBeInTheDocument();
        expect(screen.getByText('Traffic spiked on Tuesday')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'What happened' })).toBeInTheDocument();
        expect(screen.getByText('Visitors jumped Tuesday after the lineup went up on Organic Social.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Where visitors come from' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Top pages' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Ticket path' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Devices and cities' })).toBeInTheDocument();

        expect(screen.getByText('Organic Search')).toBeInTheDocument();
        expect(screen.getByText('Paid Social')).toBeInTheDocument();
        expect(screen.getByText('Viewed item')).toBeInTheDocument();
        expect(screen.getByText('Added to cart')).toBeInTheDocument();
        expect(screen.getByText('Started checkout')).toBeInTheDocument();
        expect(screen.getByText('Purchased')).toBeInTheDocument();
        expect(screen.getByTestId('analytics-path-revenue')).toHaveTextContent(/Purchase revenue CA\$/);
        expect(screen.getByText('Desktop')).toBeInTheDocument();
        expect(screen.getByText("St. John's")).toBeInTheDocument();

        expect(screen.queryByRole('navigation', { name: 'Analytics dashboard' })).not.toBeInTheDocument();
        TICKET_DB_COPY.forEach((pattern) => {
            expect(screen.queryByText(pattern)).not.toBeInTheDocument();
        });
        GA_METRIC_NAMES.forEach((pattern) => {
            expect(screen.queryByText(pattern)).not.toBeInTheDocument();
        });
        expect(screen.queryByText(EMPTY_STATE_MESSAGE)).not.toBeInTheDocument();
    });

    it('changes the numbers and every section when the site / event page changes', () => {
        mount('/analytics');

        fireEvent.change(screen.getByTestId('analytics-page-select'), {
            target: { value: 'harbour-lights-festival' },
        });

        expect(screen.getByTestId('analytics-page-select')).toHaveValue('harbour-lights-festival');
        expect(within(screen.getByTestId('analytics-kpi-visitors')).getByText('6,840')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-visitors')).queryByText('1,180')).not.toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-purchases')).getByText('540')).toBeInTheDocument();
        expect(screen.getByText('61 people on your site right now')).toBeInTheDocument();
        expect(screen.getByText('Festival visitors rose after the Saturday lineup went public.')).toBeInTheDocument();
        expect(screen.queryByText('Visitors jumped Tuesday after the lineup went up on Organic Social.')).not.toBeInTheDocument();
        expect(screen.getByText('Weekend passes')).toBeInTheDocument();
        expect(screen.getByText('Paid Social is the fastest-growing door in.')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-path-purchase')).getByText('540')).toBeInTheDocument();
        expect(screen.getByText('Montreal')).toBeInTheDocument();
    });

    it('changes the numbers and copy when the date range changes', () => {
        mount('/analytics');

        fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));

        expect(within(screen.getByTestId('analytics-kpi-visitors')).getByText('410')).toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-visitors')).queryByText('1,180')).not.toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-kpi-time')).getByText('1m 42s')).toBeInTheDocument();
        expect(screen.getByText('This week is quieter than last week after Tuesday’s Organic Social rush.')).toBeInTheDocument();
        expect(screen.getAllByText(/vs previous 7 days/).length).toBeGreaterThan(0);
        expect(screen.queryByText('Visitors jumped Tuesday after the lineup went up on Organic Social.')).not.toBeInTheDocument();
        expect(within(screen.getByTestId('analytics-path-purchase')).getByText('28')).toBeInTheDocument();
    });

    it('updates every section when All pages is selected', () => {
        mount('/analytics');

        fireEvent.change(screen.getByTestId('analytics-page-select'), {
            target: { value: 'all' },
        });

        expect(screen.getByTestId('analytics-page-select')).toHaveValue('all');
        expect(within(screen.getByTestId('analytics-kpi-visitors')).getByText('9,000')).toBeInTheDocument();
        expect(screen.getByText('92 people on your site right now')).toBeInTheDocument();
        expect(screen.getByText('Harbour Lights Festival is carrying most of the visitors this month.')).toBeInTheDocument();
        expect(screen.getByText('/events/harbour-lights-festival')).toBeInTheDocument();
    });

    it('shows the empty state for a page with no traffic', () => {
        mount('/analytics');

        fireEvent.change(screen.getByTestId('analytics-page-select'), {
            target: { value: 'quiet-harbour-acoustic' },
        });

        expect(screen.getByText(EMPTY_STATE_MESSAGE)).toBeInTheDocument();
        expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
        expect(screen.queryByText('23 people on your site right now')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'What happened' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Heads up' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Ticket path' })).not.toBeInTheDocument();
    });

    it('sorts channel cards by visitors and keeps checkout drop-off on the ticket path', () => {
        mount('/analytics');

        const channels = screen.getAllByTestId(/analytics-channel-/);
        expect(channels[0]).toHaveAttribute('data-testid', 'analytics-channel-organic-social');
        const visitorCounts = channels.map((card) => {
            const visitorsRow = within(card).getByText('Visitors').parentElement;
            return Number(visitorsRow.textContent.replace(/Visitors/g, '').replace(/,/g, '').trim());
        });
        expect([...visitorCounts].sort((left, right) => right - left)).toEqual(visitorCounts);

        expect(screen.getByText('40% drop-off to Purchased')).toBeInTheDocument();
        expect(screen.getByTestId('analytics-path-view_item')).toHaveTextContent('1,210');
        expect(screen.getByTestId('analytics-path-add_to_cart')).toHaveTextContent('340');
        expect(screen.getByTestId('analytics-path-begin_checkout')).toHaveTextContent('198');
        expect(screen.getByTestId('analytics-path-purchase')).toHaveTextContent('118');
    });

    it('writes a plain-language hover line for a day on the chart', () => {
        expect(formatChartHover({ date: '2026-11-04', visitors: 412, previous: 350 })).toBe(
            'Wed Nov 4: 412 visitors (last period 350)'
        );
        expect(formatChartHover({ date: '2026-11-18', forecast: 14 })).toBe(
            'Wed Nov 18: on pace for about 14 visitors'
        );
    });

    it('is deterministic for the same page and period', () => {
        const first = selectAnalyticsDashboard({ pageId: 'aurora-after-dark', range: '28' });
        const second = selectAnalyticsDashboard({ pageId: 'aurora-after-dark', range: '28' });
        expect(first.kpis).toEqual(second.kpis);
        expect(first.chart).toEqual(second.chart);
        expect(first.liveNow).toEqual({ people: 23, label: '23 people on your site right now' });
        expect(first.kpis.avgTime.current).toBe(102);
        expect(first.reports.daily.dimensionHeaders).toEqual([{ name: 'date' }, { name: 'pagePath' }]);
        expect(first.reports.realtime.rows[0].metricValues[0]).toEqual({ value: '23' });
    });
});
