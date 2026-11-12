import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveLine } from '@nivo/line';
import { Eye, Heart, MousePointerClick, TrendingUp, Users, FileText } from 'lucide-react';
import {
    DashboardChip,
    DashboardSection,
    DashboardStat,
    DashboardSurface,
} from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { Sparkline } from '../components/Sparkline';
import { PostCard } from '../components/PostCard';
import { DataStateBadge } from '../components/DataStateBadge';
import { COMMUNITY, LISTENING_MENTIONS, LISTENING_QUERY, LISTENING_SPIKE_DATE, LISTENING_TOPICS } from '../mockData';
import { formatNumber, formatPercent, formatSignedPercent, percentChange } from '../formatters';
import { CHART_COLORS, getChartTheme } from '../chartTheme';

const KPI_META = [
    { id: 'impressions', label: 'Visibility (impressions)', icon: Eye, accent: 'violet' },
    { id: 'engagements', label: 'Engagements', icon: Heart, accent: 'brand' },
    { id: 'engagementRate', label: 'Engagement rate by reach', icon: TrendingUp, accent: 'green' },
    { id: 'netFollowers', label: 'Net follower change', icon: Users, accent: 'blue' },
    { id: 'clicks', label: 'Outbound clicks', icon: MousePointerClick, accent: 'amber' },
    { id: 'postsPublished', label: 'Posts published', icon: FileText, accent: 'slate' },
];

const formatKpi = (id, value) => {
    if (value === null || value === undefined) return '—';
    if (id === 'engagementRate') return formatPercent(value);
    return formatNumber(Math.round(value));
};

export const OverviewView = ({ isDark, dashboard, href }) => {
    const theme = getDashboardTheme(isDark);
    const [metric, setMetric] = useState('impressions');
    const chartTheme = getChartTheme(isDark);

    const lineData = useMemo(() => {
        const field = metric === 'engagementRate' ? null : metric === 'netFollowers' ? 'netFollowers' : metric === 'postsPublished' ? 'postsPublished' : metric === 'clicks' ? 'clicks' : metric === 'engagements' ? 'engagements' : 'impressions';
        if (!field) {
            return [
                { id: 'Current rate', color: CHART_COLORS.current, data: dashboard.currentSeries.map((point) => ({ x: point.date, y: point.impressions ? (point.engagements / point.impressions) * 100 : 0 })) },
                { id: 'Prior rate', color: CHART_COLORS.prior, data: dashboard.priorSeries.map((point, index) => ({ x: dashboard.currentSeries[index]?.date || point.date, y: point.impressions ? (point.engagements / point.impressions) * 100 : 0 })) },
            ];
        }
        return [
            { id: 'Current period', color: CHART_COLORS.current, data: dashboard.currentSeries.map((point) => ({ x: point.date, y: point[field] })) },
            { id: 'Prior period', color: CHART_COLORS.prior, data: dashboard.priorSeries.map((point, index) => ({ x: dashboard.currentSeries[index]?.date || point.date, y: point[field] })) },
        ];
    }, [dashboard, metric]);

    const publishMarkers = dashboard.currentSeries
        .filter((point) => point.postsPublished > 0)
        .map((point) => ({
            axis: 'x',
            value: point.date,
            lineStyle: { stroke: '#f59e0b', strokeWidth: 1, strokeDasharray: '4 4' },
            legend: '',
        }));

    const galleryPosts = [...dashboard.posts]
        .sort((a, b) => (b.percentile || 0) - (a.percentile || 0))
        .slice(0, 6);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {KPI_META.map((item) => {
                    const kpi = dashboard.kpis[item.id];
                    const change = percentChange(kpi.current, kpi.prior);
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setMetric(item.id)}
                            className="text-left"
                            aria-pressed={metric === item.id}
                        >
                            <DashboardSurface isDark={isDark} accent={item.accent} interactive className={cn('p-4', metric === item.id && 'ring-1 ring-pink-400/40')}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className={cn('text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>{item.label}</p>
                                        <p className={cn('mt-2 text-3xl font-light tracking-tight', theme.textPrimary)}>{formatKpi(item.id, kpi.current)}</p>
                                        <p className={cn('mt-1 text-xs', change === null ? theme.textMuted : change >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                            {change === null ? 'Prior period too small to compare' : `${formatSignedPercent(change)} vs prior 28 days`}
                                        </p>
                                    </div>
                                    <Icon size={18} className="text-pink-400" />
                                </div>
                                <div className="mt-3">
                                    <Sparkline values={kpi.sparkline} isDark={isDark} />
                                </div>
                            </DashboardSurface>
                        </button>
                    );
                })}
            </div>

            <DashboardSection
                isDark={isDark}
                accent="brand"
                title="Performance over time"
                description="Daily trend for the selected metric with a prior-period overlay. Amber markers are publish dates. Click a KPI tile to change the series."
            >
                <div className="h-[320px]">
                    <ResponsiveLine
                        data={lineData}
                        theme={chartTheme}
                        margin={{ top: 16, right: 24, bottom: 48, left: 56 }}
                        xScale={{ type: 'point' }}
                        yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
                        curve="monotoneX"
                        colors={[CHART_COLORS.current, CHART_COLORS.prior]}
                        lineWidth={2}
                        pointSize={0}
                        enableArea
                        areaOpacity={0.08}
                        useMesh
                        enableSlices="x"
                        markers={publishMarkers}
                        axisBottom={{
                            tickSize: 0,
                            tickPadding: 10,
                            tickRotation: -45,
                            format: (value) => String(value).slice(5),
                        }}
                        axisLeft={{ tickSize: 0, tickPadding: 8, format: (value) => (metric === 'engagementRate' ? formatPercent(value, 1) : formatNumber(value)) }}
                        legends={[{ anchor: 'top-right', direction: 'row', translateY: -8, itemWidth: 110, itemHeight: 16, symbolSize: 8 }]}
                    />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="slate" title="Channel scorecard" description="One row per demo account. Exposure is labelled when coverage is partial or unavailable.">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className={cn('text-[10px] uppercase tracking-[0.14em]', theme.textTertiary)}>
                                <th className="py-2 pr-4">Account</th>
                                <th className="py-2 pr-4">Audience change</th>
                                <th className="py-2 pr-4">Output</th>
                                <th className="py-2 pr-4">Exposure</th>
                                <th className="py-2 pr-4">Interaction</th>
                                <th className="py-2 pr-4">Clicks</th>
                                <th className="py-2">Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboard.scorecard.map((row) => (
                                <tr key={row.id} className={cn('border-t', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                                    <td className="py-3 pr-4">
                                        <p className={theme.textPrimary}>{row.handle}</p>
                                        <p className={cn('text-xs', theme.textMuted)}>{row.platform}</p>
                                    </td>
                                    <td className="py-3 pr-4">{row.audienceChange >= 0 ? '+' : ''}{formatNumber(row.audienceChange)}</td>
                                    <td className="py-3 pr-4">{row.output}</td>
                                    <td className="py-3 pr-4">
                                        {row.exposure.state !== 'ok' ? <DataStateBadge state={row.exposure.state} /> : formatNumber(row.exposure.value)}
                                    </td>
                                    <td className="py-3 pr-4">{formatNumber(row.interaction.value)}</td>
                                    <td className="py-3 pr-4">{formatNumber(row.clicks.value)}</td>
                                    <td className={cn('py-3 text-xs', theme.textMuted)}>{row.sourceLabel}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                accent="violet"
                title="Post gallery"
                description="Strong posts, posts below their usual range, and posts with active discussion. Performance and audience response are separate readings."
                actions={<Link to={href('posts')} className="text-sm text-pink-400">Open all posts</Link>}
            >
                <div className="flex gap-4 overflow-x-auto pb-2">
                    {galleryPosts.map((post) => (
                        <div key={post.id} className="w-[260px] shrink-0">
                            <PostCard post={post} isDark={isDark} compact to={href(`posts/${post.id}`)} />
                        </div>
                    ))}
                </div>
            </DashboardSection>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <DashboardSection isDark={isDark} accent="green" title="Community pulse" description="Comment volume, open questions, and leading themes from owned posts.">
                    <div className="grid grid-cols-3 gap-3">
                        <DashboardStat isDark={isDark} label="Comments" value={formatNumber(COMMUNITY.incomingComments)} detail={`${COMMUNITY.classified} classified`} />
                        <DashboardStat isDark={isDark} label="Open questions" value={String(COMMUNITY.openQuestions)} detail="Owned comments" />
                        <DashboardStat isDark={isDark} label="Response rate" value={formatPercent(COMMUNITY.responseRate, 0)} detail={`${COMMUNITY.respondedConversations} of ${COMMUNITY.eligibleConversations}`} />
                    </div>
                    <p className={cn('mt-4 text-sm font-light', theme.textSecondary)}>
                        Leading positive theme: praise for colour / lineup. Leading negative theme: limited merch stock.
                    </p>
                    <Link to={href('community')} className="mt-3 inline-block text-sm text-pink-400">Open community report</Link>
                </DashboardSection>
                <DashboardSection isDark={isDark} accent="amber" title="Brand conversation" description={`${LISTENING_QUERY.name}. Terms and sources stay visible on the listening view.`}>
                    <div className="flex flex-wrap gap-2">
                        {LISTENING_TOPICS.slice(0, 4).map((topic) => (
                            <DashboardChip key={topic.id} isDark={isDark}>{topic.label} · {topic.mentions}</DashboardChip>
                        ))}
                    </div>
                    <p className={cn('mt-4 text-sm font-light', theme.textSecondary)}>
                        Mentions spiked on {LISTENING_SPIKE_DATE}. Sample: {LISTENING_MENTIONS[0].text}
                    </p>
                    <Link to={href(`listening?spike=${LISTENING_SPIKE_DATE}`)} className="mt-3 inline-block text-sm text-pink-400">Open listening query</Link>
                </DashboardSection>
            </div>

            <DashboardSection isDark={isDark} accent="brand" title="Insights" description="Each line is verifiable against the mock posts or mentions behind it.">
                <ul className="space-y-3">
                    {dashboard.insights.map((insight) => {
                        const target = insight.to.view === 'post'
                            ? href(`posts/${insight.to.postId}${insight.to.params?.theme ? `?theme=${encodeURIComponent(insight.to.params.theme)}` : ''}`)
                            : insight.to.view === 'listening'
                                ? href(`listening?spike=${insight.to.params.spike}`)
                                : href(`posts?platform=${insight.to.params.platform}&format=${insight.to.params.format}`);
                        return (
                            <li key={insight.id}>
                                <Link to={target} className={cn('block rounded-md border p-4 transition', isDark ? 'border-dashboard-border hover:bg-dashboard-panelAlt' : 'border-slate-200 hover:bg-slate-50')}>
                                    <p className={cn('text-sm font-light leading-6', theme.textPrimary)}>{insight.text}</p>
                                    <p className="mt-2 text-xs text-pink-400">Open supporting view</p>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </DashboardSection>
        </div>
    );
};
