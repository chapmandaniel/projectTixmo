import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveLine } from '@nivo/line';
import { DashboardChip, DashboardSection, DashboardStat } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { LISTENING_MENTIONS, LISTENING_QUERY, LISTENING_SPIKE_DATE, LISTENING_TOPICS, SHARE_OF_VOICE } from '../mockData';
import { formatNumber, formatPercent } from '../formatters';
import { CHART_COLORS, getChartTheme } from '../chartTheme';

export const ListeningView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);
    const [params] = useSearchParams();
    const spike = params.get('spike') || LISTENING_SPIKE_DATE;

    const mentionSeries = useMemo(() => [{
        id: 'Mentions',
        data: dashboard.currentSeries.map((point) => ({ x: point.date, y: point.mentions })),
    }], [dashboard.currentSeries]);

    const spikeMentions = LISTENING_MENTIONS.filter((mention) => mention.date === spike);

    return (
        <div className="space-y-6">
            <DashboardSection
                isDark={isDark}
                accent="amber"
                title="Social listening and brand health"
                description="Matched public mentions for a fixed mock query. Coverage, terms and sources stay visible on every chart."
            >
                <div className="flex flex-wrap gap-2">
                    {LISTENING_QUERY.terms.map((term) => <DashboardChip key={term} isDark={isDark}>{term}</DashboardChip>)}
                </div>
                <p className={cn('mt-3 text-sm font-light', theme.textSecondary)}>
                    Sources: {LISTENING_QUERY.sources.join(' · ')}. {LISTENING_QUERY.coverageNote}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                    <DashboardStat isDark={isDark} label="Mentions this period" value={formatNumber(dashboard.currentSeries.reduce((sum, point) => sum + point.mentions, 0))} />
                    <DashboardStat isDark={isDark} label="Spike day" value={spike} />
                    <DashboardStat isDark={isDark} label="Share of voice" value="38%" detail="Northlight in the mock peer set" />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="brand" title="Mentions timeline" description="Daily matched mentions. The 28 Oct spike is the Aurora / Fog City clip cluster.">
                <div className="h-[240px]">
                    <ResponsiveLine
                        data={mentionSeries}
                        theme={getChartTheme(isDark)}
                        margin={{ top: 12, right: 16, bottom: 48, left: 40 }}
                        xScale={{ type: 'point' }}
                        yScale={{ type: 'linear', min: 0, max: 'auto' }}
                        colors={[CHART_COLORS.paid]}
                        curve="monotoneX"
                        enableArea
                        areaOpacity={0.12}
                        pointSize={0}
                        useMesh
                        markers={[{ axis: 'x', value: spike, lineStyle: { stroke: '#f43f5e', strokeWidth: 1, strokeDasharray: '4 3' } }]}
                        axisBottom={{ tickRotation: -45, tickSize: 0, format: (value) => String(value).slice(5) }}
                        axisLeft={{ tickSize: 0 }}
                    />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="violet" title="Topics" description="Recurring topics in the mock query. Sentiment is a simple average over classified mentions.">
                <div className="h-[220px]">
                    <ResponsiveBar
                        data={LISTENING_TOPICS}
                        keys={['mentions']}
                        indexBy="label"
                        theme={getChartTheme(isDark)}
                        colors={[CHART_COLORS.current]}
                        margin={{ top: 8, right: 8, bottom: 48, left: 40 }}
                        padding={0.35}
                        enableLabel={false}
                        axisBottom={{ tickRotation: -20, tickSize: 0 }}
                        axisLeft={{ tickSize: 0 }}
                    />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="slate" title="Spike drill-down" description={`${spikeMentions.length} sampled mentions contributed to ${spike}. This is a mock extract, not a full firehose.`}>
                <ul className="space-y-3">
                    {spikeMentions.map((mention) => (
                        <li key={mention.id} className={cn('rounded-md border p-3', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                            <p className={theme.textPrimary}>{mention.text}</p>
                            <p className={cn('mt-1 text-xs', theme.textMuted)}>{mention.source} · {mention.author} · {mention.sentiment} · {mention.topic}</p>
                        </li>
                    ))}
                </ul>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="blue" title="Share of voice" description="Brand-matched mentions ÷ all brand-matched mentions in the fixed peer set. Multi-brand mentions are counted once per brand.">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className={cn('text-[10px] uppercase tracking-[0.14em]', theme.textTertiary)}>
                                <th className="py-2 pr-4">Brand</th>
                                <th className="py-2 pr-4">Mentions</th>
                                <th className="py-2">Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {SHARE_OF_VOICE.map((row) => (
                                <tr key={row.brand} className={cn('border-t', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                                    <td className="py-2 pr-4">{row.brand}</td>
                                    <td className="py-2 pr-4">{formatNumber(row.mentions)}</td>
                                    <td className="py-2">{formatPercent(row.share, 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DashboardSection>
        </div>
    );
};
