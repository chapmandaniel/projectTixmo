import React from 'react';
import { cn } from '../../../lib/utils';
import { getDashboardTheme } from '../../../lib/dashboardTheme';

const LABELS = {
    unavailable: 'Unavailable',
    awaiting: 'Awaiting data',
    partial: 'Partial',
    building: 'Building baseline',
};

export const DataStateBadge = ({ state, className }) => {
    if (!state || state === 'ok') return null;
    const tone = state === 'unavailable'
        ? 'border-rose-400/30 text-rose-300'
        : state === 'awaiting'
            ? 'border-amber-400/30 text-amber-200'
            : 'border-sky-400/30 text-sky-200';

    return (
        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]', tone, className)}>
            {LABELS[state] || state}
        </span>
    );
};

export const MetricReadout = ({ isDark, value, state = 'ok', note, children }) => {
    const theme = getDashboardTheme(isDark);
    if (state && state !== 'ok') {
        return (
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-xl font-light', theme.textPrimary)}>{LABELS[state] || '—'}</span>
                    <DataStateBadge state={state} />
                </div>
                {note ? <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>{note}</p> : null}
            </div>
        );
    }
    return (
        <div>
            <div className={cn('text-xl font-light tracking-tight', theme.textPrimary)}>{children ?? value}</div>
            {note ? <p className={cn('mt-1 text-xs font-light', theme.textMuted)}>{note}</p> : null}
        </div>
    );
};
