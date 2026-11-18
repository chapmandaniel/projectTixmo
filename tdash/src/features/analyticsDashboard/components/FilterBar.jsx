import React from 'react';
import { DashboardChip, DashboardSelect, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { DATE_RANGE_OPTIONS } from '../mockAnalytics';

export const FilterBar = ({ isDark, pageId, range, pages, onChange, liveNow }) => {
    const theme = getDashboardTheme(isDark);

    const chipClass = (active) => cn(
        'inline-flex h-10 items-center justify-center rounded-full border px-3 text-sm font-light transition',
        active
            ? (isDark ? 'border-white/40 bg-white/10 text-white' : 'border-slate-900 bg-slate-900 text-white')
            : (isDark ? 'border-dashboard-border bg-dashboard-panelMuted text-zinc-300 hover:bg-dashboard-panelAlt' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
    );

    return (
        <DashboardSurface isDark={isDark} accent="violet" className="px-4 py-2.5 sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-1">
                    <label className="block sm:max-w-xs sm:flex-1">
                        <span className={cn('mb-1 block text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>
                            Site / event page
                        </span>
                        <DashboardSelect
                            isDark={isDark}
                            value={pageId}
                            onChange={(event) => onChange({ pageId: event.target.value, range })}
                            aria-label="Site / event page"
                            data-testid="analytics-page-select"
                        >
                            {pages.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </DashboardSelect>
                    </label>
                    <div className="flex flex-wrap items-center gap-2 sm:pt-5" role="group" aria-label="Date range">
                        {DATE_RANGE_OPTIONS.map((option) => {
                            const active = String(range) === option.id;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={chipClass(active)}
                                    aria-pressed={active}
                                    aria-label={option.label}
                                    data-testid={`analytics-range-${option.id}`}
                                    onClick={() => onChange({ pageId, range: option.id })}
                                >
                                    {option.short}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {liveNow ? (
                        <div data-testid="analytics-live-now">
                            <DashboardChip isDark={isDark} className="px-4 py-2 text-sm">
                                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                                {liveNow.label}
                            </DashboardChip>
                        </div>
                    ) : null}
                    <p className={cn('text-xs font-light', theme.textMuted)} data-testid="analytics-updated">
                        Updated 5 min ago
                    </p>
                </div>
            </div>
        </DashboardSurface>
    );
};
