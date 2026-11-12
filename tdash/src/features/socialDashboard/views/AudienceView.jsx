import React, { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveLine } from '@nivo/line';
import { DashboardChip, DashboardSection, DashboardStat } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { AUDIENCE } from '../mockData';
import { DataStateBadge } from '../components/DataStateBadge';
import { formatNumber, formatPercent } from '../formatters';
import { CHART_COLORS, getChartTheme } from '../chartTheme';

export const AudienceView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);
    const followersOpen = dashboard.accounts.reduce((sum, account) => sum + account.followersOpen, 0);
    const followersClose = dashboard.accounts.reduce((sum, account) => sum + account.followersClose, 0);
    const gained = dashboard.accounts.reduce((sum, account) => sum + account.followersGained, 0);
    const lost = dashboard.accounts.reduce((sum, account) => sum + account.followersLost, 0);

    const lineData = useMemo(() => {
        let running = followersOpen;
        return [
            {
                id: 'Follower base',
                data: dashboard.currentSeries.map((point) => {
                    running += point.netFollowers;
                    return { x: point.date, y: running };
                }),
            },
        ];
    }, [dashboard.currentSeries, followersOpen]);

    const netBars = dashboard.currentSeries.map((point) => ({
        date: point.date.slice(5),
        net: point.netFollowers,
    }));

    return (
        <div className="space-y-6">
            <DashboardSection isDark={isDark} accent="blue" title="Audience and growth" description="Followers at the start and end of the period, with reported gains and losses. Publication dates are marked on the Overview timeline.">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <DashboardStat isDark={isDark} label="Opening followers" value={formatNumber(followersOpen)} />
                    <DashboardStat isDark={isDark} label="Closing followers" value={formatNumber(followersClose)} />
                    <DashboardStat isDark={isDark} label="Gained" value={`+${formatNumber(gained)}`} />
                    <DashboardStat isDark={isDark} label="Lost" value={formatNumber(lost)} detail={`Net ${formatNumber(followersClose - followersOpen)} · ${formatPercent(((followersClose - followersOpen) / followersOpen) * 100, 1)}`} />
                </div>
                <div className="mt-6 h-[240px]">
                    <ResponsiveLine
                        data={lineData}
                        theme={getChartTheme(isDark)}
                        margin={{ top: 12, right: 16, bottom: 36, left: 56 }}
                        xScale={{ type: 'point' }}
                        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                        colors={[CHART_COLORS.secondary]}
                        curve="monotoneX"
                        enableArea
                        areaOpacity={0.1}
                        pointSize={0}
                        useMesh
                        axisBottom={{ tickRotation: -45, tickSize: 0, format: (value) => String(value).slice(5) }}
                        axisLeft={{ tickSize: 0, format: (value) => formatNumber(value) }}
                    />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="slate" title="Daily net change" description="Bars show movement. The line above shows scale.">
                <div className="h-[220px]">
                    <ResponsiveBar
                        data={netBars}
                        keys={['net']}
                        indexBy="date"
                        theme={getChartTheme(isDark)}
                        colors={[CHART_COLORS.positive]}
                        margin={{ top: 8, right: 8, bottom: 48, left: 40 }}
                        padding={0.2}
                        enableLabel={false}
                        axisBottom={{ tickRotation: -45, tickSize: 0 }}
                        axisLeft={{ tickSize: 0 }}
                    />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="violet" title="Demographics" description={`Population: ${AUDIENCE.populationLabel}. Multi-account views stay scoped to this Instagram extract.`}>
                <DashboardChip isDark={isDark}>Population: followers</DashboardChip>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <p className={cn('text-xs uppercase tracking-[0.14em]', theme.textTertiary)}>Countries</p>
                        <ul className="mt-2 space-y-1 text-sm">
                            {AUDIENCE.countries.map((row) => <li key={row.id} className="flex justify-between"><span>{row.label}</span><span>{row.value}%</span></li>)}
                        </ul>
                    </div>
                    <div>
                        <p className={cn('text-xs uppercase tracking-[0.14em]', theme.textTertiary)}>Cities</p>
                        <ul className="mt-2 space-y-1 text-sm">
                            {AUDIENCE.cities.map((row) => (
                                <li key={row.id} className="flex justify-between">
                                    <span>{row.label}</span>
                                    {row.state ? <DataStateBadge state={row.state} /> : <span>{row.value}%</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <p className={cn('text-xs uppercase tracking-[0.14em]', theme.textTertiary)}>Age bands</p>
                        <ul className="mt-2 space-y-1 text-sm">
                            {AUDIENCE.ages.map((row) => <li key={row.id} className="flex justify-between"><span>{row.label}</span><span>{row.value}%</span></li>)}
                        </ul>
                    </div>
                </div>
            </DashboardSection>
        </div>
    );
};
