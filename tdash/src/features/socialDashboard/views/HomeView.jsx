import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveLine } from '@nivo/line';
import {
    DashboardSection,
    DashboardSurface,
} from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { FAN_MENTIONS } from '../mockData';
import { buildHomeStory } from '../homeStory';
import { mentionSourcePlatform, parsePlatformFilter } from '../platforms';
import { PostCard } from '../components/PostCard';
import { AttentionGrid } from '../components/AttentionGrid';
import { NOT_AVAILABLE } from '../plainCopy';
import { formatNumber, formatSignedPercent, percentChange } from '../formatters';
import { CHART_COLORS, getChartTheme } from '../chartTheme';

const TILES = [
    { id: 'peopleReached', label: 'People reached' },
    { id: 'likesCommentsShares', label: 'Likes, comments & shares' },
    { id: 'newFollowers', label: 'New followers' },
    { id: 'linkClicks', label: 'Link clicks' },
];

const ChartBox = ({ children }) => {
    const ref = useRef(null);
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const update = () => setReady(node.clientWidth > 8 && node.clientHeight > 8);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    return (
        <div ref={ref} className="h-[280px] w-full">
            {ready ? children : null}
        </div>
    );
};

const changeLine = (change, days) => {
    if (change === null) return `vs previous ${days} days`;
    const direction = change >= 0 ? 'up' : 'down';
    return `${direction} ${formatSignedPercent(Math.abs(change)).replace('+', '')} vs previous ${days} days`;
};

export const HomeView = ({ isDark, dashboard, href }) => {
    const theme = getDashboardTheme(isDark);
    const days = dashboard.rangeDays || 28;
    const storyPosts = dashboard.publishedInPeriod?.length ? dashboard.publishedInPeriod : dashboard.posts;
    const selectedPlatforms = dashboard.accounts.map((account) => account.platform);
    const lookingAtAll = parsePlatformFilter(dashboard.filters?.platform).length === 0;
    const mentions = FAN_MENTIONS.filter((mention) => {
        const platform = mentionSourcePlatform(mention.source);
        if (!platform) return lookingAtAll;
        return selectedPlatforms.includes(platform);
    });
    const { topPosts, whatHappened, attention, bestTimeToPost } = buildHomeStory(storyPosts, days, mentions);

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
            <AttentionGrid isDark={isDark} cards={attention} href={href} />

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
                {whatHappened.length ? (
                    <ul className="space-y-3">
                        {whatHappened.map((item) => (
                            <li key={item.id}>
                                <Link to={href(item.to)} className={cn('block rounded-md border p-4', isDark ? 'border-dashboard-border hover:bg-dashboard-panelAlt' : 'border-slate-200 hover:bg-slate-50')}>
                                    <p className={cn('text-sm font-light leading-6', theme.textPrimary)}>{item.text}</p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className={cn('text-sm font-light', theme.textSecondary)}>Nothing notable for this filter yet.</p>
                )}
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="brand" title="Top posts">
                {topPosts.length ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {topPosts.map((post) => (
                            <PostCard key={post.id} post={post} isDark={isDark} compact to={href(`posts/${post.id}`)} />
                        ))}
                    </div>
                ) : (
                    <p className={cn('text-sm font-light', theme.textSecondary)}>No posts in this filter yet.</p>
                )}
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="slate" title="People reached" description="This period vs last. Dots mark days you posted.">
                <ChartBox>
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
                </ChartBox>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="amber" title="Best time to post">
                <p className={cn('text-lg font-light', theme.textPrimary)}>{bestTimeToPost}</p>
            </DashboardSection>
        </div>
    );
};
