import React from 'react';
import { BigStatTile } from '../../../components/dashboard/BigStatTile';
import { WhatHappenedList } from '../../../components/dashboard/WhatHappenedList';
import { TrendChart } from '../../../components/dashboard/TrendChart';
import { DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { CHART_COLORS } from '../../../components/dashboard/chartTheme';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { HeadsUpCards } from '../components/HeadsUpCards';
import { formatChartHover, formatDuration, formatNumber, percentChange } from '../formatters';
import { ChannelsView } from './ChannelsView';
import { TicketPathView } from './TicketPathView';
import { TopPagesView } from './TopPagesView';
import { DevicesCitiesView } from './DevicesCitiesView';

const sliceValue = (slice, seriesId) => {
    const point = slice.points.find((item) => item.seriesId === seriesId);
    if (!point || point.data.y == null) return null;
    return Number(point.data.y);
};

export const HomeView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);
    const days = dashboard.rangeDays;
    const kpis = dashboard.kpis;

    const lineData = [
        { id: 'This period', color: CHART_COLORS.current, data: dashboard.chart.current },
        { id: 'Last period', color: CHART_COLORS.prior, data: dashboard.chart.previous },
        { id: 'Forecast', color: CHART_COLORS.forecast, data: dashboard.chart.forecast },
    ];

    const formatSlice = (slice) => {
        const visitors = sliceValue(slice, 'This period');
        const previous = sliceValue(slice, 'Last period');
        const forecast = sliceValue(slice, 'Forecast');
        const date = slice.points[0]?.data?.x;
        return formatChartHover({ date, visitors, previous, forecast });
    };

    return (
        <div className="space-y-6">
            <div
                data-testid="analytics-home-hero"
                className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-stretch"
            >
                <div className="order-2 lg:order-1" data-testid="analytics-hero-chart">
                    <DashboardSurface isDark={isDark} accent="brand" className="flex h-full flex-col p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-light">
                            <span className={cn('inline-flex items-center gap-2', theme.textSecondary)}>
                                <span className="h-0.5 w-4 rounded-full bg-pink-500" aria-hidden="true" />
                                This period
                            </span>
                            <span className={cn('inline-flex items-center gap-2', theme.textSecondary)}>
                                <span className="h-0.5 w-4 rounded-full bg-slate-500" aria-hidden="true" />
                                Last period
                            </span>
                            <span className={cn('inline-flex items-center gap-2', theme.textSecondary)}>
                                <span className="h-px w-4 border-t border-dashed border-amber-400" aria-hidden="true" />
                                Forecast
                            </span>
                        </div>
                        <TrendChart
                            isDark={isDark}
                            data={lineData}
                            colors={[CHART_COLORS.current, CHART_COLORS.prior, CHART_COLORS.forecast]}
                            formatY={(value) => formatNumber(value)}
                            formatSlice={formatSlice}
                            heightClassName="h-[240px] lg:h-[280px]"
                        />
                        <p className={cn('mt-2 text-sm font-light leading-6', theme.textPrimary)} data-testid="analytics-pace">
                            {dashboard.pace}
                        </p>
                    </DashboardSurface>
                </div>
                <div className="order-1 grid grid-cols-2 grid-rows-2 gap-3 lg:order-2" data-testid="analytics-hero-stats">
                    <div data-testid="analytics-kpi-visitors">
                        <BigStatTile
                            isDark={isDark}
                            label="Visitors"
                            value={formatNumber(kpis.visitors.current)}
                            change={percentChange(kpis.visitors.current, kpis.visitors.prior)}
                            days={days}
                            className="p-3 sm:p-4"
                            valueClassName="text-[1.85rem] sm:text-4xl lg:text-[2.35rem] xl:text-[2.35rem]"
                        />
                    </div>
                    <div data-testid="analytics-kpi-pageviews">
                        <BigStatTile
                            isDark={isDark}
                            label="Page views"
                            value={formatNumber(kpis.pageViews.current)}
                            change={percentChange(kpis.pageViews.current, kpis.pageViews.prior)}
                            days={days}
                            className="p-3 sm:p-4"
                            valueClassName="text-[1.85rem] sm:text-4xl lg:text-[2.35rem] xl:text-[2.35rem]"
                        />
                    </div>
                    <div data-testid="analytics-kpi-time">
                        <BigStatTile
                            isDark={isDark}
                            label="Avg time on site"
                            value={formatDuration(kpis.avgTime.current)}
                            change={percentChange(kpis.avgTime.current, kpis.avgTime.prior)}
                            days={days}
                            className="p-3 sm:p-4"
                            valueClassName="text-[1.85rem] sm:text-4xl lg:text-[2.35rem] xl:text-[2.35rem]"
                        />
                    </div>
                    <div data-testid="analytics-kpi-purchases">
                        <BigStatTile
                            isDark={isDark}
                            label="Purchases"
                            value={formatNumber(kpis.purchases.current)}
                            change={percentChange(kpis.purchases.current, kpis.purchases.prior)}
                            days={days}
                            className="p-3 sm:p-4"
                            valueClassName="text-[1.85rem] sm:text-4xl lg:text-[2.35rem] xl:text-[2.35rem]"
                        />
                    </div>
                </div>
            </div>

            <HeadsUpCards isDark={isDark} cards={dashboard.headsUp} />
            <WhatHappenedList isDark={isDark} items={dashboard.whatHappened} />
            <ChannelsView isDark={isDark} dashboard={dashboard} />
            <TopPagesView isDark={isDark} dashboard={dashboard} />
            <TicketPathView isDark={isDark} dashboard={dashboard} />
            <DevicesCitiesView isDark={isDark} dashboard={dashboard} />
        </div>
    );
};
