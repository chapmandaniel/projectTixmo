import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import { DashboardChip, DashboardSection } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { CONTENT_THEMES, engagementRateByReach, engagementTotal } from '../mockData';
import { formatNumber, formatPercent } from '../formatters';
import { CHART_COLORS, getChartTheme } from '../chartTheme';
import { PostThumbnail } from '../components/PostThumbnail';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ContentView = ({ isDark, dashboard, href }) => {
    const theme = getDashboardTheme(isDark);
    const formatRows = useMemo(() => {
        const groups = new Map();
        dashboard.posts.forEach((post) => {
            const current = groups.get(post.format) || { format: post.format, posts: 0, interactions: 0, rates: [] };
            current.posts += 1;
            current.interactions += engagementTotal(post);
            const rate = engagementRateByReach(post);
            if (rate !== null) current.rates.push(rate);
            groups.set(post.format, current);
        });
        return [...groups.values()].map((row) => ({
            ...row,
            share: dashboard.posts.length ? (row.posts / dashboard.posts.length) * 100 : 0,
            typicalRate: row.rates.length ? row.rates.reduce((sum, value) => sum + value, 0) / row.rates.length : null,
        }));
    }, [dashboard.posts]);

    const heatmap = DAYS.map((day, dayIndex) => ({
        id: day,
        data: Array.from({ length: 12 }, (_, hour) => {
            const slot = hour * 2;
            const posts = dashboard.posts.filter((post) => {
                const published = new Date(post.publishedAt);
                return published.getDay() === dayIndex && Math.floor(published.getHours() / 2) === hour;
            });
            const median = posts.length
                ? posts.map((post) => engagementRateByReach(post) || 0).sort((a, b) => a - b)[Math.floor(posts.length / 2)]
                : 0;
            return { x: `${String(slot).padStart(2, '0')}:00`, y: Number(median.toFixed(2)), posts: posts.length };
        }),
    }));

    const videos = dashboard.posts.filter((post) => post.videoRetention);

    return (
        <div className="space-y-6">
            <DashboardSection isDark={isDark} accent="violet" title="Formats" description="Post count, share of output, and typical interaction rate per post. Totals and per-post rates are both shown.">
                <div className="h-[260px]">
                    <ResponsiveBar
                        data={formatRows}
                        keys={['posts']}
                        indexBy="format"
                        theme={getChartTheme(isDark)}
                        colors={[CHART_COLORS.current]}
                        margin={{ top: 12, right: 16, bottom: 36, left: 36 }}
                        padding={0.4}
                        borderRadius={4}
                        enableLabel={false}
                        axisLeft={{ tickSize: 0 }}
                        axisBottom={{ tickSize: 0 }}
                    />
                </div>
                <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className={cn('text-[10px] uppercase tracking-[0.14em]', theme.textTertiary)}>
                                <th className="py-2 pr-3">Format</th>
                                <th className="py-2 pr-3">Posts</th>
                                <th className="py-2 pr-3">Share of output</th>
                                <th className="py-2 pr-3">Interactions</th>
                                <th className="py-2">Typical rate / post</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formatRows.map((row) => (
                                <tr key={row.format} className={cn('border-t', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                                    <td className="py-2 pr-3">{row.format}</td>
                                    <td className="py-2 pr-3">{row.posts}</td>
                                    <td className="py-2 pr-3">{formatPercent(row.share, 0)}</td>
                                    <td className="py-2 pr-3">{formatNumber(row.interactions)}</td>
                                    <td className="py-2">{row.typicalRate === null ? '—' : formatPercent(row.typicalRate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="brand" title="Themes and campaigns" description="Posts may appear under more than one tag. Overlapping totals are labelled, not deduplicated.">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {CONTENT_THEMES.map((item) => (
                        <div key={item.id} className={cn('rounded-md border p-4', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                            <p className={theme.textPrimary}>{item.label}</p>
                            <p className={cn('mt-1 text-xs', theme.textMuted)}>{item.posts} posts · {item.networks.join(', ')}</p>
                            <p className={cn('mt-3 text-sm', theme.textSecondary)}>{formatNumber(item.interactions)} interactions · typical {formatPercent(item.typicalRate)}</p>
                            <Link to={href(`posts?theme=${encodeURIComponent(item.id)}`)} className="mt-2 inline-block text-sm text-pink-400">Open posts</Link>
                        </div>
                    ))}
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="amber" title="Timing heatmap" description="Median engagement rate by weekday and hour for posts in this mock extract. Historical post performance, not audience-online times.">
                <div className="h-[280px]">
                    <ResponsiveHeatMap
                        data={heatmap}
                        theme={getChartTheme(isDark)}
                        margin={{ top: 12, right: 16, bottom: 36, left: 40 }}
                        colors={{ type: 'sequential', scheme: 'pink_yellowGreen' }}
                        emptyColor={isDark ? '#171723' : '#f8fafc'}
                        borderRadius={2}
                        axisTop={null}
                        axisRight={null}
                    />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="blue" title="Video" description="Native views and mock retention for clips in the extract. Discovery sources stay labelled as mock.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {videos.map((post) => (
                        <Link key={post.id} to={href(`posts/${post.id}`)} className="block">
                            <div className="grid grid-cols-[96px_1fr] gap-3">
                                <PostThumbnail post={post} className="h-28" />
                                <div>
                                    <p className={theme.textPrimary}>{post.thumbnailLabel}</p>
                                    <p className={cn('text-xs', theme.textMuted)}>{post.platform} · {post.format}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <DashboardChip isDark={isDark}>{formatNumber(post.views.value)} views</DashboardChip>
                                        <DashboardChip isDark={isDark}>Retention mock</DashboardChip>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </DashboardSection>
        </div>
    );
};
