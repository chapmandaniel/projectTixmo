import React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { DashboardSection, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { formatNumber } from '../formatters';

const TrendIcon = ({ trend, className }) => {
    if (trend === 'up') return <ArrowUpRight className={className} size={18} aria-label="up" />;
    if (trend === 'down') return <ArrowDownRight className={className} size={18} aria-label="down" />;
    return <ArrowRight className={className} size={18} aria-label="flat" />;
};

export const TopPagesView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <DashboardSection isDark={isDark} accent="slate" title="Top pages" description="Views this period, with a simple up, down, or flat mark vs last period.">
            <div className="space-y-2" data-testid="analytics-top-pages">
                {dashboard.topPages.map((page) => (
                    <DashboardSurface key={page.path} isDark={isDark} accent={false} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                            <p className={cn('truncate text-sm font-light', theme.textPrimary)}>{page.title}</p>
                            <p className={cn('truncate text-xs font-light', theme.textMuted)}>{page.path}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                            <p className={cn('text-lg font-light', theme.textPrimary)}>{formatNumber(page.current)}</p>
                            <TrendIcon
                                trend={page.trend}
                                className={page.trend === 'up' ? 'text-emerald-400' : page.trend === 'down' ? 'text-rose-400' : theme.textMuted}
                            />
                        </div>
                    </DashboardSurface>
                ))}
            </div>
        </DashboardSection>
    );
};
