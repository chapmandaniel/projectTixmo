import React from 'react';
import { DashboardSection, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { formatCurrencyCad, formatNumber } from '../formatters';

export const ChannelsView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <div className="space-y-6">
            <DashboardSection
                isDark={isDark}
                accent="amber"
                title="Where buyers came from"
                description="Sorted by tickets. Demo numbers only."
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {dashboard.channels.map((channel) => (
                        <DashboardSurface key={channel.id} isDark={isDark} accent="slate" className="p-5" data-testid={`analytics-channel-${channel.id}`}>
                            <p className={cn('text-lg font-light', theme.textPrimary)}>{channel.label}</p>
                            <dl className="mt-4 space-y-2 text-sm font-light">
                                <div className="flex items-center justify-between gap-3">
                                    <dt className={theme.textSecondary}>Event page visitors</dt>
                                    <dd className={theme.textPrimary}>{formatNumber(channel.visitors)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt className={theme.textSecondary}>Tickets</dt>
                                    <dd className={theme.textPrimary}>{formatNumber(channel.tickets)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt className={theme.textSecondary}>Revenue (CAD)</dt>
                                    <dd className={theme.textPrimary}>{formatCurrencyCad(channel.revenue)}</dd>
                                </div>
                            </dl>
                        </DashboardSurface>
                    ))}
                </div>
            </DashboardSection>

            <DashboardSurface isDark={isDark} accent="violet" className="p-5">
                <p className={cn('text-sm font-light leading-6', theme.textPrimary)} data-testid="analytics-buyers-tip">
                    {dashboard.channelTip}
                </p>
            </DashboardSurface>
        </div>
    );
};
