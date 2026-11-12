import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardSection } from './DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';

export const WhatHappenedList = ({ isDark, items, emptyText = 'Nothing notable for this filter yet.' }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <DashboardSection isDark={isDark} accent="violet" title="What happened">
            {items?.length ? (
                <ul className="space-y-3">
                    {items.map((item) => {
                        const body = (
                            <p className={cn('text-sm font-light leading-6', theme.textPrimary)}>{item.text}</p>
                        );
                        const wrapClass = cn(
                            'block rounded-md border p-4',
                            isDark ? 'border-dashboard-border hover:bg-dashboard-panelAlt' : 'border-slate-200 hover:bg-slate-50'
                        );
                        return (
                            <li key={item.id}>
                                {item.to?.startsWith('#') ? (
                                    <a href={item.to} className={wrapClass}>
                                        {body}
                                    </a>
                                ) : item.to ? (
                                    <Link to={item.to} className={wrapClass}>
                                        {body}
                                    </Link>
                                ) : (
                                    <div
                                        className={cn(
                                            'rounded-md border p-4',
                                            isDark ? 'border-dashboard-border' : 'border-slate-200'
                                        )}
                                    >
                                        {body}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className={cn('text-sm font-light', theme.textSecondary)}>{emptyText}</p>
            )}
        </DashboardSection>
    );
};
