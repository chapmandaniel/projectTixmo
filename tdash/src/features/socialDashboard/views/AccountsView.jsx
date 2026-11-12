import React from 'react';
import { DashboardSection } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { NOT_AVAILABLE } from '../plainCopy';
import { formatNumber } from '../formatters';

export const AccountsView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <DashboardSection isDark={isDark} accent="slate" title="Accounts" description="One row per connected account.">
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className={cn('text-[10px] uppercase tracking-[0.14em]', theme.textTertiary)}>
                            <th className="py-2 pr-4">Account</th>
                            <th className="py-2 pr-4">People reached</th>
                            <th className="py-2 pr-4">New followers</th>
                            <th className="py-2 pr-4">Likes, comments & shares</th>
                            <th className="py-2">Link clicks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dashboard.scorecard.map((row) => (
                            <tr key={row.id} className={cn('border-t', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                                <td className="py-3 pr-4">
                                    <p className={theme.textPrimary}>{row.handle}</p>
                                    <p className={cn('text-xs', theme.textMuted)}>{row.platform}</p>
                                </td>
                                <td className="py-3 pr-4">{row.exposure.state !== 'ok' ? NOT_AVAILABLE : formatNumber(row.exposure.value)}</td>
                                <td className="py-3 pr-4">{formatNumber(row.audienceChange)}</td>
                                <td className="py-3 pr-4">{formatNumber(row.interaction.value)}</td>
                                <td className="py-3">{formatNumber(row.clicks.value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </DashboardSection>
    );
};
