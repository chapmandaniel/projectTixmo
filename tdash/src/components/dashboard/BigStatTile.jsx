import React from 'react';
import { DashboardSurface } from './DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';

export const changeVsPreviousLine = (change, days) => {
    if (change === null || change === undefined) return `vs previous ${days} days`;
    const direction = change >= 0 ? 'up' : 'down';
    const amount = `${Math.abs(change).toFixed(1)}%`;
    return `${direction} ${amount} vs previous ${days} days`;
};

export const BigStatTile = ({ isDark, label, value, change, days, changeLine, className, valueClassName }) => {
    const theme = getDashboardTheme(isDark);
    const line = changeLine || changeVsPreviousLine(change, days);
    const tone = change === null || change === undefined
        ? theme.textMuted
        : change >= 0
            ? 'text-emerald-400'
            : 'text-rose-400';

    return (
        <DashboardSurface isDark={isDark} accent="slate" className={cn('flex h-full flex-col justify-between p-4 sm:p-5', className)}>
            <p className={cn('text-xs font-light leading-5 sm:text-sm', theme.textSecondary)}>{label}</p>
            <p className={cn('mt-2 text-4xl font-light tracking-tight sm:text-5xl lg:text-[2.75rem] xl:text-6xl', theme.textPrimary, valueClassName)}>
                {value}
            </p>
            <p className={cn('mt-2 text-xs sm:text-sm', tone)}>{line}</p>
        </DashboardSurface>
    );
};
