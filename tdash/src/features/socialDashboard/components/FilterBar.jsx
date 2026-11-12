import React from 'react';
import { DashboardChip, DashboardSelect, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { ACCOUNTS, CURRENT_RANGE, LAST_REFRESH_AT, PRIOR_RANGE, REPORT_TIMEZONE, SCOPE_LABEL } from '../mockData';
import { formatDateTime } from '../formatters';
import { MetricDefinitionsPopover } from './MetricDefinitionsPopover';

const PLATFORMS = ['all', 'instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'];
const DISTRIBUTIONS = ['all', 'organic', 'paid', 'combined', 'unknown'];

export const FilterBar = ({ isDark, filters, onChange }) => {
    const theme = getDashboardTheme(isDark);

    const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });

    return (
        <DashboardSurface isDark={isDark} accent="violet" className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block">
                        <span className={cn('mb-1 block text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Date range</span>
                        <DashboardSelect isDark={isDark} value="current28" disabled>
                            <option value="current28">{CURRENT_RANGE.label} vs {PRIOR_RANGE.label}</option>
                        </DashboardSelect>
                    </label>
                    <label className="block">
                        <span className={cn('mb-1 block text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Account</span>
                        <DashboardSelect isDark={isDark} value={filters.accountId} onChange={set('accountId')}>
                            <option value="all">All demo accounts</option>
                            {ACCOUNTS.map((account) => (
                                <option key={account.id} value={account.id}>{account.handle} · {account.platform}</option>
                            ))}
                        </DashboardSelect>
                    </label>
                    <label className="block">
                        <span className={cn('mb-1 block text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Platform</span>
                        <DashboardSelect isDark={isDark} value={filters.platform} onChange={set('platform')}>
                            {PLATFORMS.map((platform) => (
                                <option key={platform} value={platform}>{platform === 'all' ? 'All platforms' : platform}</option>
                            ))}
                        </DashboardSelect>
                    </label>
                    <label className="block">
                        <span className={cn('mb-1 block text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Distribution</span>
                        <DashboardSelect isDark={isDark} value={filters.distribution} onChange={set('distribution')}>
                            {DISTRIBUTIONS.map((value) => (
                                <option key={value} value={value}>{value === 'all' ? 'Combined + unknown' : value}</option>
                            ))}
                        </DashboardSelect>
                    </label>
                </div>
                <MetricDefinitionsPopover isDark={isDark} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <DashboardChip isDark={isDark}>{SCOPE_LABEL}</DashboardChip>
                <DashboardChip isDark={isDark}>{REPORT_TIMEZONE}</DashboardChip>
                <DashboardChip isDark={isDark}>{CURRENT_RANGE.start} → {CURRENT_RANGE.end}</DashboardChip>
                <span className={cn('text-xs font-light', theme.textMuted)}>Last refresh {formatDateTime(LAST_REFRESH_AT)}</span>
            </div>
        </DashboardSurface>
    );
};
