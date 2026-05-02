import React from 'react';
import { Archive, CalendarClock } from 'lucide-react';
import {
    DashboardChip,
    DashboardPage,
    DashboardSection,
    DashboardTitleBar,
} from '../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../lib/dashboardTheme';

const DashboardPlaceholderView = ({
    isDark,
    title,
    description = 'This module has been cleared out and reserved for future development.',
    icon: Icon = Archive,
}) => {
    const theme = getDashboardTheme(isDark);

    return (
        <DashboardPage className="mx-auto max-w-[1100px] space-y-6">
            <DashboardTitleBar
                isDark={isDark}
                title={title}
                description={description}
                icon={Icon}
                iconClassName="text-fuchsia-300"
                badges={(
                    <DashboardChip isDark={isDark} className="uppercase tracking-[0.18em]">
                        Future module
                    </DashboardChip>
                )}
            />

            <DashboardSection
                isDark={isDark}
                accent="slate"
                title="Placeholder"
                description="No active workflows, API calls, generated content, or monitoring jobs are attached to this space."
            >
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-dashboard-border/80 px-5 py-10 text-center">
                    <CalendarClock size={26} className={theme.textMuted} />
                    <h3 className={theme.textPrimary}>Ready for a future build</h3>
                    <p className={`max-w-lg text-sm font-light leading-6 ${theme.textSecondary}`}>
                        The previous implementation has been removed so the next version can start from a clean surface.
                    </p>
                </div>
            </DashboardSection>
        </DashboardPage>
    );
};

export default DashboardPlaceholderView;
