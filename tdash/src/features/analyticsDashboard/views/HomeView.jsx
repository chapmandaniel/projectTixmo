import React from 'react';
import { BigStatTile } from '../../../components/dashboard/BigStatTile';
import { WhatHappenedList } from '../../../components/dashboard/WhatHappenedList';
import { TrendChart } from '../../../components/dashboard/TrendChart';
import { DashboardChip, DashboardSection } from '../../../components/dashboard/DashboardPrimitives';
import { CHART_COLORS } from '../../../components/dashboard/chartTheme';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { HeadsUpCards } from '../components/HeadsUpCards';
import { formatCurrencyCad, formatNumber, percentChange } from '../formatters';

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

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            {dashboard.liveNow ? (
                <div data-testid="analytics-live-now">
                    <DashboardChip isDark={isDark} className="px-4 py-2 text-sm">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                        {dashboard.liveNow.label}
                    </DashboardChip>
                </div>
            ) : null}

            <HeadsUpCards isDark={isDark} cards={dashboard.headsUp} />
            <WhatHappenedList isDark={isDark} items={dashboard.whatHappened} />

            <DashboardSection
                isDark={isDark}
                accent="brand"
                title="Tickets sold and event page visitors"
                description="This period, with a dotted line for the days still ahead."
            >
                <TrendChart
                    isDark={isDark}
                    data={lineData}
                    colors={[CHART_COLORS.current, CHART_COLORS.secondary, CHART_COLORS.forecast]}
                    formatY={(value) => formatNumber(value)}
                />
                <p className={cn('mt-4 text-sm font-light leading-6', theme.textPrimary)} data-testid="analytics-pace">
                    {dashboard.pace}
                </p>
            </DashboardSection>
        </div>
    );
};
