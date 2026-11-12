import React from 'react';
import { DashboardSection, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { formatNumber } from '../formatters';

export const ChannelsView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <DashboardSection
            isDark={isDark}
            accent="amber"
            title="Where visitors come from"
            description="Sorted by visitors."
            className="scroll-mt-24"
        >
            <div id="where-visitors" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {dashboard.channels.map((channel) => (
                    <DashboardSurface key={channel.id} isDark={isDark} accent="slate" className="p-5" data-testid={`analytics-channel-${channel.id}`}>
                        <p className={cn('text-lg font-light', theme.textPrimary)}>{channel.label}</p>
                        <dl className="mt-4 space-y-2 text-sm font-light">
                            <div className="flex items-center justify-between gap-3">
                                <dt className={theme.textSecondary}>Visitors</dt>
                                <dd className={theme.textPrimary}>{formatNumber(channel.visitors)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className={theme.textSecondary}>Purchases</dt>
                                <dd className={theme.textPrimary}>{formatNumber(channel.purchases)}</dd>
                            </div>
                        </dl>
                        {channel.tip ? (
                            <p className={cn('mt-4 text-sm font-light leading-6', theme.textSecondary)}>{channel.tip}</p>
                        ) : null}
                    </DashboardSurface>
                ))}
            </div>
        </DashboardSection>
    );
};
