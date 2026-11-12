import React from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { DashboardChip, DashboardSection, DashboardStat } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { PAID_ORGANIC } from '../mockData';
import { formatCurrency, formatNumber, formatPercent } from '../formatters';
import { CHART_COLORS, getChartTheme } from '../chartTheme';

export const PaidView = ({ isDark }) => {
    const theme = getDashboardTheme(isDark);
    const { currency, organic, paid, campaigns, attributionWindow } = PAID_ORGANIC;
    const paidCtr = paid.impressions ? (paid.clicks / paid.impressions) * 100 : 0;
    const organicCtr = organic.impressions ? (organic.clicks / organic.impressions) * 100 : 0;
    const cpc = paid.clicks ? paid.spend / paid.clicks : 0;
    const cpm = paid.impressions ? (paid.spend / paid.impressions) * 1000 : 0;

    return (
        <div className="space-y-6">
            <DashboardSection
                isDark={isDark}
                accent="amber"
                title="Paid vs organic"
                description="Ad-account delivery versus owned-profile activity. Labels stay organic, paid, provider combined, or unknown. Currency is CAD."
            >
                <div className="flex flex-wrap gap-2">
                    <DashboardChip isDark={isDark}>Reporting currency {currency}</DashboardChip>
                    <DashboardChip isDark={isDark}>{attributionWindow}</DashboardChip>
                    <DashboardChip isDark={isDark}>Source: mock ad account + mock profile API</DashboardChip>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <DashboardStat isDark={isDark} label={`Paid spend (${currency})`} value={formatCurrency(paid.spend, currency)} />
                    <DashboardStat isDark={isDark} label="Paid impressions" value={formatNumber(paid.impressions)} />
                    <DashboardStat isDark={isDark} label="CPM" value={formatCurrency(cpm, currency)} />
                    <DashboardStat isDark={isDark} label="Outbound CPC" value={formatCurrency(cpc, currency)} />
                    <DashboardStat isDark={isDark} label="Paid CTR" value={formatPercent(paidCtr)} detail={`${formatNumber(paid.clicks)} outbound clicks`} />
                    <DashboardStat isDark={isDark} label="Paid reach" value={formatNumber(paid.reach)} detail={`Frequency ${paid.frequency}`} />
                    <DashboardStat isDark={isDark} label="Organic CTR" value={formatPercent(organicCtr)} />
                    <DashboardStat isDark={isDark} label="Organic engagements" value={formatNumber(organic.engagements)} />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="violet" title="Delivery side by side" description="Organic metrics and paid metrics keep separate scopes. A promoted post still has its organic row in Posts.">
                <div className="h-[240px]">
                    <ResponsiveBar
                        data={[
                            { metric: 'Impressions', organic: organic.impressions, paid: paid.impressions },
                            { metric: 'Engagements', organic: organic.engagements, paid: paid.engagements },
                            { metric: 'Clicks', organic: organic.clicks, paid: paid.clicks },
                        ]}
                        keys={['organic', 'paid']}
                        indexBy="metric"
                        groupMode="grouped"
                        theme={getChartTheme(isDark)}
                        colors={[CHART_COLORS.organic, CHART_COLORS.paid]}
                        margin={{ top: 16, right: 16, bottom: 36, left: 56 }}
                        padding={0.3}
                        enableLabel={false}
                        axisLeft={{ tickSize: 0, format: (value) => formatNumber(value) }}
                        axisBottom={{ tickSize: 0 }}
                        legends={[{ dataFrom: 'keys', anchor: 'top-right', direction: 'row', itemWidth: 80, itemHeight: 16, symbolSize: 8 }]}
                    />
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="slate" title="Campaigns" description="Goal and attribution window stay on each row. Result = outbound click.">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className={cn('text-[10px] uppercase tracking-[0.14em]', theme.textTertiary)}>
                                <th className="py-2 pr-3">Campaign</th>
                                <th className="py-2 pr-3">Platform</th>
                                <th className="py-2 pr-3">Spend</th>
                                <th className="py-2 pr-3">Impressions</th>
                                <th className="py-2 pr-3">CTR</th>
                                <th className="py-2 pr-3">CPC</th>
                                <th className="py-2">CPM</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.map((row) => (
                                <tr key={row.id} className={cn('border-t', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                                    <td className="py-3 pr-3">{row.name}</td>
                                    <td className="py-3 pr-3">{row.platform}</td>
                                    <td className="py-3 pr-3">{formatCurrency(row.spend, currency)}</td>
                                    <td className="py-3 pr-3">{formatNumber(row.impressions)}</td>
                                    <td className="py-3 pr-3">{formatPercent(row.ctr)}</td>
                                    <td className="py-3 pr-3">{formatCurrency(row.cpc, currency)}</td>
                                    <td className="py-3">{formatCurrency(row.cpm, currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DashboardSection>
        </div>
    );
};
