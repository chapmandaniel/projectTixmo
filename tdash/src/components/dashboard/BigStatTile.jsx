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

export const BigStatTile = ({ isDark, label, value, change, days, changeLine }) => {
    const theme = getDashboardTheme(isDark);
    const line = changeLine || changeVsPreviousLine(change, days);
    const tone = change === null || change === undefined
        ? theme.textMuted
        : change >= 0
            ? 'text-emerald-400'
            : 'text-rose-400';

    return (
        <DashboardSurface isDark={isDark} accent="slate" className="p-5">
            <p className={cn('text-sm', theme.textSecondary)}>{label}</p>
            <p className={cn('mt-3 text-4xl font-light tracking-tight sm:text-5xl', theme.textPrimary)}>
                {value}
            </p>
            <p className={cn('mt-2 text-sm', tone)}>{line}</p>
        </DashboardSurface>
    );
};
