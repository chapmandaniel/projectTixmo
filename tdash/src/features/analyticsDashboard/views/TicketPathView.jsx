import React from 'react';
import { DashboardSection, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { formatCurrencyCad, formatNumber } from '../formatters';

export const TicketPathView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);
    const steps = dashboard.ticketPath;
    const max = Math.max(...steps.map((step) => step.count), 1);

    return (
        <DashboardSection
            isDark={isDark}
            accent="violet"
            title="Ticket path"
            description="How people move from a viewed item to a purchase."
            className="scroll-mt-24"
        >
            <div id="ticket-path" className="space-y-4">
                {steps.map((step) => {
                    const width = `${Math.max(8, Math.round((step.count / max) * 100))}%`;
                    return (
                        <DashboardSurface key={step.id} isDark={isDark} accent="slate" className="p-4 sm:p-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <p className={cn('text-sm', theme.textSecondary)}>{step.label}</p>
                                <p className={cn('text-3xl font-light tracking-tight sm:text-4xl', theme.textPrimary)} data-testid={`analytics-path-${step.id}`}>
                                    {formatNumber(step.count)}
                                </p>
                            </div>
                            <div className={cn('mt-4 h-3 overflow-hidden rounded-full', isDark ? 'bg-dashboard-panelMuted' : 'bg-slate-100')}>
                                <div className="h-full rounded-full bg-pink-500" style={{ width }} />
                            </div>
                            {step.dropOff ? (
                                <p className={cn('mt-3 text-sm font-light leading-6', theme.textPrimary)}>{step.dropOff}</p>
                            ) : null}
                            {step.revenue != null ? (
                                <p className={cn('mt-1 text-sm font-light', theme.textSecondary)} data-testid="analytics-path-revenue">
                                    Purchase revenue {formatCurrencyCad(step.revenue)}
                                </p>
                            ) : null}
                        </DashboardSurface>
                    );
                })}
            </div>
        </DashboardSection>
    );
};
