import React from 'react';
import { DashboardChip, DashboardSection } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { COMPETITORS } from '../mockData';
import { DataStateBadge } from '../components/DataStateBadge';
import { formatNumber } from '../formatters';

export const CompetitorsView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);
    const ownIg = dashboard.accounts.find((account) => account.platform === 'instagram');

    return (
        <div className="space-y-6">
            <DashboardSection
                isDark={isDark}
                accent="slate"
                title="Competitors and benchmarks"
                description="Three comparison levels: previous period (Overview), selected peers on the same platform, then a disclosed industry sample. Public comments and reactions are a different set from connected-only metrics such as saves and reach."
            >
                <div className="flex flex-wrap gap-2">
                    <DashboardChip isDark={isDark}>Peer set: 4 demo promoters</DashboardChip>
                    <DashboardChip isDark={isDark}>Platform-matched public interactions</DashboardChip>
                    <DashboardChip isDark={isDark}>Industry sample: not licensed in this prototype</DashboardChip>
                </div>
                <p className={cn('mt-4 text-sm font-light', theme.textSecondary)}>
                    Northlight Instagram close: {formatNumber(ownIg?.followersClose || 0)} followers.
                    Fair comparison uses the same available interactions, denominator, age and platform.
                </p>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="violet" title="Mock peer table" description="Public interaction metrics only. Signal Club is awaiting a public post sample.">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className={cn('text-[10px] uppercase tracking-[0.14em]', theme.textTertiary)}>
                                <th className="py-2 pr-3">Peer</th>
                                <th className="py-2 pr-3">Platform</th>
                                <th className="py-2 pr-3">Followers</th>
                                <th className="py-2 pr-3">Posts</th>
                                <th className="py-2 pr-3">Public interactions / post</th>
                                <th className="py-2 pr-3">Format mix</th>
                                <th className="py-2">Top public post</th>
                            </tr>
                        </thead>
                        <tbody>
                            {COMPETITORS.map((row) => (
                                <tr key={row.id} className={cn('border-t', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                                    <td className="py-3 pr-3">{row.name}</td>
                                    <td className="py-3 pr-3">{row.platform}</td>
                                    <td className="py-3 pr-3">{formatNumber(row.followers)}</td>
                                    <td className="py-3 pr-3">{row.posts}</td>
                                    <td className="py-3 pr-3">
                                        {row.state ? <DataStateBadge state={row.state} /> : formatNumber(row.publicInteractionsPerPost)}
                                    </td>
                                    <td className="py-3 pr-3">{row.formatMix}</td>
                                    <td className="py-3">{row.topPost}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DashboardSection>
        </div>
    );
};
