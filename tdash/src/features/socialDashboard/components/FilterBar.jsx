import React from 'react';
import { DashboardSelect, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { ACCOUNTS, DATE_RANGE_OPTIONS } from '../mockData';

export const FilterBar = ({ isDark, filters, onChange }) => {
    const theme = getDashboardTheme(isDark);
    const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });

    return (
        <DashboardSurface isDark={isDark} accent="violet" className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                        <span className={cn('mb-1 block text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Date range</span>
                        <DashboardSelect isDark={isDark} value={String(filters.range || '28')} onChange={set('range')}>
                            {DATE_RANGE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </DashboardSelect>
                    </label>
                    <label className="block">
                        <span className={cn('mb-1 block text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Account</span>
                        <DashboardSelect isDark={isDark} value={filters.accountId} onChange={set('accountId')}>
                            <option value="all">All accounts</option>
                            {ACCOUNTS.map((account) => (
                                <option key={account.id} value={account.id}>{account.handle}</option>
                            ))}
                        </DashboardSelect>
                    </label>
                </div>
                <p className={cn('text-xs font-light', theme.textMuted)}>Updated 5 min ago</p>
            </div>
        </DashboardSurface>
    );
};
