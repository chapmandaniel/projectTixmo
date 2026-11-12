import React from 'react';
import { BigStatTile } from '../../../components/dashboard/BigStatTile';
import { WhatHappenedList } from '../../../components/dashboard/WhatHappenedList';
import { TrendChart } from '../../../components/dashboard/TrendChart';
import { DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { CHART_COLORS } from '../../../components/dashboard/chartTheme';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { HeadsUpCards } from '../components/HeadsUpCards';
import { formatChartHover, formatCurrencyCad, formatNumber, percentChange } from '../formatters';

const sliceValue = (slice, seriesId) => {
    const point = slice.points.find((item) => item.seriesId === seriesId);
    if (!point || point.data.y == null) return null;
    return Number(point.data.y);
};

export const HomeView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);
    const days = dashboard.rangeDays;
    const kpis = dashboard.kpis;
    const ticketsChange = percentChange(kpis.ticketsSold.current, kpis.ticketsSold.prior);
    const revenueChange = percentChange(kpis.revenue.current, kpis.revenue.prior);
    const visitorsChange = percentChange(kpis.visitors.current, kpis.visitors.prior);
    const boughtChange = percentChange(kpis.boughtPer100.current, kpis.boughtPer100.prior);

    const lineData = [
        { id: 'Tickets sold', color: CHART_COLORS.current, data: dashboard.chart.tickets },
        { id: 'Event page visitors', color: CHART_COLORS.secondary, data: dashboard.chart.visitors },
        { id: 'Forecast', color: CHART_COLORS.forecast, data: dashboard.chart.forecast },
    ];

    const formatSlice = (slice) => {
        const tickets = sliceValue(slice, 'Tickets sold');
        const visitors = sliceValue(slice, 'Event page visitors');
        const forecast = sliceValue(slice, 'Forecast');
        const date = slice.points[0]?.data?.x;
        return formatChartHover({ date, tickets, visitors, forecast });
    };

    return (
        <div className="space-y-6">
            <div
                data-testid="analytics-home-hero"
                className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-stretch"
            >
                <div className="order-2 lg:order-1" data-testid="analytics-hero-chart">
                    <DashboardSurface isDark={isDark} accent="brand" className="flex h-full flex-col p-4 sm:p-5">
                        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-light">
                            <span className={cn('inline-flex items-center gap-2', theme.textSecondary)}>
                                <span className="h-0.5 w-4 rounded-full bg-pink-500" aria-hidden="true" />
                                Tickets sold
                            </span>
                            <span className={cn('inline-flex items-center gap-2', theme.textSecondary)}>
                                <span className="h-0.5 w-4 rounded-full bg-cyan-400" aria-hidden="true" />
                                Event page visitors
                            </span>
                            <span className={cn('inline-flex items-center gap-2', theme.textSecondary)}>
                                <span className="h-px w-4 border-t border-dashed border-amber-400" aria-hidden="true" />
                                Forecast
                            </span>
                        </div>
                        <TrendChart
                            isDark={isDark}
                            data={lineData}
                            colors={[CHART_COLORS.current, CHART_COLORS.secondary, CHART_COLORS.forecast]}
                            formatY={(value) => formatNumber(value)}
                            formatSlice={formatSlice}
                            heightClassName="h-[300px] min-h-[260px] flex-1 lg:h-[360px]"
                        />
                        <p className={cn('mt-3 text-sm font-light leading-6', theme.textPrimary)} data-testid="analytics-pace">
                            {dashboard.pace}
                        </p>
                    </DashboardSurface>
                </div>
                <div className="order-1 grid grid-cols-2 grid-rows-2 gap-3 lg:order-2" data-testid="analytics-hero-stats">
                    <div data-testid="analytics-kpi-tickets">
                        <BigStatTile
                            isDark={isDark}
                            label="Tickets sold"
                            value={formatNumber(kpis.ticketsSold.current)}
                            change={ticketsChange}
                            days={days}
                        />
                    </div>
                    <div data-testid="analytics-kpi-revenue">
                        <BigStatTile
                            isDark={isDark}
                            label="Revenue (CAD)"
                            value={formatCurrencyCad(kpis.revenue.current)}
                            change={revenueChange}
                            days={days}
                        />
                    </div>
                    <div data-testid="analytics-kpi-visitors">
                        <BigStatTile
                            isDark={isDark}
                            label="Event page visitors"
                            value={formatNumber(kpis.visitors.current)}
                            change={visitorsChange}
                            days={days}
                        />
                    </div>
                    <div data-testid="analytics-kpi-bought">
                        <BigStatTile
                            isDark={isDark}
                            label={`Out of every 100 visitors, ${formatNumber(kpis.boughtPer100.current)} bought`}
                            value={formatNumber(kpis.boughtPer100.current)}
                            change={boughtChange}
                            days={days}
                        />
                    </div>
                </div>
            </div>

            <HeadsUpCards isDark={isDark} cards={dashboard.headsUp} />
            <WhatHappenedList isDark={isDark} items={dashboard.whatHappened} />
        </div>
    );
};
