import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { DashboardButton, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { METRIC_DEFINITIONS } from '../mockData';

export const MetricDefinitionsPopover = ({ isDark }) => {
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const theme = getDashboardTheme(isDark);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        const onClick = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onClick);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onClick);
        };
    }, [open]);

    return (
        <div className="relative" ref={panelRef}>
            <DashboardButton isDark={isDark} variant="secondary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
                <BookOpen size={16} />
                Metric definitions
            </DashboardButton>
            {open ? (
                <DashboardSurface
                    isDark={isDark}
                    accent="slate"
                    className="absolute right-0 z-30 mt-2 w-[min(32rem,calc(100vw-2rem))] p-4 shadow-dashboard-soft"
                    role="dialog"
                    aria-label="Metric definitions"
                >
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <h3 className={cn('text-base font-light', theme.textPrimary)}>Metric definitions</h3>
                            <p className={cn('mt-1 text-xs font-light', theme.textSecondary)}>From the 11 Nov 2026 research plan. Comparisons only hold when time scope and definition match.</p>
                        </div>
                        <button type="button" className={theme.iconButton} onClick={() => setOpen(false)} aria-label="Close metric definitions">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                        {METRIC_DEFINITIONS.map((metric) => (
                            <div key={metric.id} className={cn('rounded-md border p-3', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                                <p className={cn('text-sm', theme.textPrimary)}>{metric.name}</p>
                                <p className={cn('mt-1 text-xs font-light leading-5', theme.textSecondary)}>{metric.definition}</p>
                            </div>
                        ))}
                    </div>
                </DashboardSurface>
            ) : null}
        </div>
    );
};
