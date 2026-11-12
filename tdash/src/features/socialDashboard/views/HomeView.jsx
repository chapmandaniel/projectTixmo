import React from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveLine } from '@nivo/line';
import {
    DashboardSection,
    DashboardSurface,
} from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { ATTENTION_ITEMS, BEST_TIME_TO_POST, WHAT_HAPPENED } from '../mockData';
import { PostCard } from '../components/PostCard';
import { NOT_AVAILABLE } from '../plainCopy';
import { formatNumber, formatSignedPercent, percentChange } from '../formatters';
import { CHART_COLORS, getChartTheme } from '../chartTheme';

const TILES = [
    { id: 'peopleReached', label: 'People reached' },
    { id: 'likesCommentsShares', label: 'Likes, comments & shares' },
    { id: 'newFollowers', label: 'New followers' },
    { id: 'linkClicks', label: 'Link clicks' },
];

const changeLine = (change, days) => {
    if (change === null) return `vs previous ${days} days`;
    const direction = change >= 0 ? 'up' : 'down';
    return `${direction} ${formatSignedPercent(Math.abs(change)).replace('+', '')} vs previous ${days} days`;
};

export const HomeView = ({ isDark, dashboard, href }) => {
    const theme = getDashboardTheme(isDark);
    const days = dashboard.rangeDays || 28;
    const topPosts = [...dashboard.posts]
        .sort((a, b) => (b.reach.value || 0) - (a.reach.value || 0))
        .slice(0, 3);

    const lineData = [
        { id: 'This period', color: CHART_COLORS.current, data: dashboard.currentSeries.map((point) => ({ x: point.date, y: point.impressions })) },
        { id: 'Last period', color: CHART_COLORS.prior, data: dashboard.priorSeries.map((point, index) => ({ x: dashboard.currentSeries[index]?.date || point.date, y: point.impressions })) },
    ];

    const postDots = dashboard.currentSeries
        .filter((point) => point.postsPublished > 0)
        .map((point) => ({
            axis: 'x',
            value: point.date,
            lineStyle: { stroke: CHART_COLORS.paid, strokeWidth: 1, strokeDasharray: '4 4' },
        }));

    return (
        <div className="space-y-6">
            {ATTENTION_ITEMS.length ? (
                <DashboardSection isDark={isDark} accent="brand" title="Needs your attention">
                    <ul className="space-y-3">
                        {ATTENTION_ITEMS.map((item) => (
                            <li key={item.id} className={cn('flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                                <div>
                                    <p className={theme.textPrimary}>{item.title}</p>
                                    <p className={cn('mt-1 text-sm font-light', theme.textSecondary)}>{item.reason}</p>
                                </div>
                                <Link to={href(item.to)} className="inline-flex items-center justify-center rounded-md border border-dashboard-accent bg-dashboard-accent px-4 py-2.5 text-sm font-light text-white">
                                    Open
                                </Link>
                            </li>
                        ))}
                    </ul>
                </DashboardSection>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {TILES.map((tile) => {
                    const kpi = dashboard.kpis[tile.id];
                    const unavailable = tile.id === 'peopleReached' && kpi && kpi.available === false;
                    const change = unavailable ? null : percentChange(kpi.current, kpi.prior);
                    return (
                        <DashboardSurface key={tile.id} isDark={isDark} accent="slate" className="p-5">
                            <p className={cn('text-sm', theme.textSecondary)}>{tile.label}</p>
                            <p className={cn('mt-3 text-4xl font-light tracking-tight sm:text-5xl', theme.textPrimary)}>
                                {unavailable ? NOT_AVAILABLE : formatNumber(Math.round(kpi.current))}
                            </p>
                            <p className={cn('mt-2 text-sm', change === null ? theme.textMuted : change >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                {unavailable ? '' : changeLine(change, days)}
                            </p>
                        </DashboardSurface>
                    );
                })}
            </div>

            <DashboardSection isDark={isDark} accent="violet" title="What happened">
                <ul className="space-y-3">
                    {WHAT_HAPPENED.map((item) => (
                        <li key={item.id}>
                            <Link to={href(item.to)} className={cn('block rounded-md border p-4', isDark ? 'border-dashboard-border hover:bg-dashboard-panelAlt' : 'border-slate-200 hover:bg-slate-50')}>
                                <p className={cn('text-sm font-light leading-6', theme.textPrimary)}>{item.text}</p>
                            </Link>
                        </li>
                    ))}
                </ul>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="brand" title="Top posts">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {topPosts.map((post) => (
                        <PostCard key={post.id} post={post} isDark={isDark} compact to={href(`posts/${post.id}`)} />
                    ))}
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="slate" title="People reached" description="This period vs last. Dots mark days you posted.">
                <div className="h-[280px]">
                    <ResponsiveLine
                        data={lineData}
                        theme={getChartTheme(isDark)}
                        margin={{ top: 16, right: 24, bottom: 48, left: 56 }}
                        xScale={{ type: 'point' }}
                        yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
                        curve="monotoneX"
                        colors={[CHART_COLORS.current, CHART_COLORS.prior]}
                        lineWidth={2}
                        pointSize={0}
                        enableArea={false}
                        useMesh
                        markers={postDots}
                        axisBottom={{
                            tickSize: 0,
                            tickPadding: 10,
                            tickRotation: -45,
                            format: (value) => String(value).slice(5),
                        }}
                        axisLeft={{ tickSize: 0, tickPadding: 8, format: (value) => formatNumber(value) }}
                        legends={[{ anchor: 'top-right', direction: 'row', translateY: -8, itemWidth: 110, itemHeight: 16, symbolSize: 8 }]}
                    />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="amber" title="Best time to post">
                <p className={cn('text-lg font-light', theme.textPrimary)}>{BEST_TIME_TO_POST}</p>
            </DashboardSection>
        </div>
    );
};
