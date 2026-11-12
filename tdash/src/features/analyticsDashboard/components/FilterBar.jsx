import React from 'react';
import { DashboardSelect, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { DATE_RANGE_OPTIONS } from '../mockAnalytics';

export const FilterBar = ({ isDark, eventId, range, events, onChange }) => {
    const theme = getDashboardTheme(isDark);

    const chipClass = (active) => cn(
        'inline-flex h-10 items-center justify-center rounded-full border px-3 text-sm font-light transition',
        active
            ? (isDark ? 'border-white/40 bg-white/10 text-white' : 'border-slate-900 bg-slate-900 text-white')
            : (isDark ? 'border-dashboard-border bg-dashboard-panelMuted text-zinc-300 hover:bg-dashboard-panelAlt' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
    );

    return (
        <DashboardSurface isDark={isDark} accent="violet" className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <label className="block sm:max-w-sm sm:flex-1">
                    <span className={cn('mb-1 block text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Event</span>
                    <DashboardSelect
                        isDark={isDark}
                        value={eventId}
                        onChange={(event) => onChange({ eventId: event.target.value, range })}
                        aria-label="Event"
                        data-testid="analytics-event-select"
                    >
                        {events.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </DashboardSelect>
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-end">
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
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
                                    onClick={() => onChange({ eventId, range: option.id })}
                                >
                                    {option.short}
                                </button>
                            );
                        })}
                    </div>
                    <p className={cn('text-xs font-light', theme.textMuted)} data-testid="analytics-updated">
                        Updated 5 min ago
                    </p>
                </div>
            </div>
        </DashboardSurface>
    );
};
