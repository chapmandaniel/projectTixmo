import React from 'react';
import { DashboardSection, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { formatNumber } from '../formatters';

export const DevicesCitiesView = ({ isDark, dashboard }) => {
    const theme = getDashboardTheme(isDark);

    return (
        <DashboardSection
            isDark={isDark}
            accent="slate"
            title="Devices and cities"
            description="How people arrive, and where they are."
        >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div data-testid="analytics-devices">
                    <p className={cn('mb-3 text-sm font-light', theme.textSecondary)}>Devices</p>
                    <div className="space-y-3">
                        {dashboard.devices.map((device) => (
                            <DashboardSurface key={device.id} isDark={isDark} accent={false} className="p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className={cn('text-sm font-light', theme.textPrimary)}>{device.label}</p>
                                    <p className={cn('text-sm font-light', theme.textSecondary)}>
                                        {formatNumber(device.visitors)} · {device.share}%
                                    </p>
                                </div>
                                <div className={cn('mt-3 h-2 overflow-hidden rounded-full', isDark ? 'bg-dashboard-panelMuted' : 'bg-slate-100')}>
                                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(4, device.share)}%` }} />
                                </div>
                            </DashboardSurface>
                        ))}
                    </div>
                </div>
                <div data-testid="analytics-cities">
                    <p className={cn('mb-3 text-sm font-light', theme.textSecondary)}>Top cities</p>
                    <div className="space-y-2">
                        {dashboard.cities.map((city) => (
                            <div key={city.id} className="flex items-center justify-between gap-3 px-1 py-2">
                                <p className={cn('text-sm font-light', theme.textPrimary)}>{city.label}</p>
                                <p className={cn('text-sm font-light', theme.textSecondary)}>{formatNumber(city.visitors)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardSection>
    );
};
