import React from 'react';
import { DashboardSelect, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { ACCOUNTS, DATE_RANGE_OPTIONS } from '../mockData';
import { parsePlatformFilter, platformsInMocks, serializePlatformFilter } from '../platforms';
import { PlatformLogo } from './PlatformLogo';

export const FilterBar = ({ isDark, filters, onChange }) => {
    const theme = getDashboardTheme(isDark);
    const selectedPlatforms = parsePlatformFilter(filters.platform);
    const allPlatforms = platformsInMocks(ACCOUNTS);
    const allActive = selectedPlatforms.length === 0;
    const accountChoices = selectedPlatforms.length
        ? ACCOUNTS.filter((account) => selectedPlatforms.includes(account.platform))
        : ACCOUNTS;

    const setRange = (range) => onChange({ ...filters, range });
    const setAccount = (event) => onChange({ ...filters, accountId: event.target.value });
    const setPlatforms = (ids) => {
        const next = { ...filters, platform: serializePlatformFilter(ids) || 'all' };
        const allowed = ids.length ? ACCOUNTS.filter((account) => ids.includes(account.platform)) : ACCOUNTS;
        if (next.accountId !== 'all' && !allowed.some((account) => account.id === next.accountId)) {
            next.accountId = 'all';
        }
        onChange(next);
    };

    const togglePlatform = (id) => {
        if (id === 'all') {
            setPlatforms([]);
            return;
        }
        const next = selectedPlatforms.includes(id)
            ? selectedPlatforms.filter((item) => item !== id)
            : [...selectedPlatforms, id];
        setPlatforms(next);
    };

    const chipClass = (active) => cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-full border px-3 text-sm font-light transition',
        active
            ? (isDark ? 'border-white/40 bg-white/10 text-white' : 'border-slate-900 bg-slate-900 text-white')
            : (isDark ? 'border-dashboard-border bg-dashboard-panelMuted text-zinc-300 hover:bg-dashboard-panelAlt' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
    );

    return (
        <DashboardSurface isDark={isDark} accent="violet" className="p-4 sm:p-5">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Platform">
                        <button
                            type="button"
                            className={chipClass(allActive)}
                            aria-pressed={allActive}
                            onClick={() => togglePlatform('all')}
                        >
                            All
                        </button>
                        {allPlatforms.map((item) => {
                            const active = selectedPlatforms.includes(item.id);
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={cn(chipClass(active), 'min-w-10 px-2.5')}
                                    aria-pressed={active}
                                    aria-label={item.label}
                                    title={item.label}
                                    onClick={() => togglePlatform(item.id)}
                                >
                                    <PlatformLogo platform={item.id} className="h-4 w-4" title={item.label} />
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
                        {DATE_RANGE_OPTIONS.map((option) => {
                            const active = String(filters.range || '28') === String(option.id);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={chipClass(active)}
                                    aria-pressed={active}
                                    onClick={() => setRange(option.id)}
                                >
                                    {option.short}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="block sm:max-w-xs sm:flex-1">
                        <span className={cn('mb-1 block text-[10px] uppercase tracking-[0.16em]', theme.textTertiary)}>Account</span>
                        <DashboardSelect isDark={isDark} value={filters.accountId} onChange={setAccount}>
                            <option value="all">All accounts</option>
                            {accountChoices.map((account) => (
                                <option key={account.id} value={account.id}>{account.handle}</option>
                            ))}
                        </DashboardSelect>
                    </label>
                    <p className={cn('text-xs font-light', theme.textMuted)}>Updated 5 min ago</p>
                </div>
            </div>
        </DashboardSurface>
    );
};
