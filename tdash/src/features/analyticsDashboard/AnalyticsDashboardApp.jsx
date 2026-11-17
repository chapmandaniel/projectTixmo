import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    DashboardChip,
    DashboardEmptyState,
    DashboardPage,
} from '../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';
import { FilterBar } from './components/FilterBar';
import {
    DEFAULT_PAGE_ID,
    DEFAULT_RANGE,
    MOCK_PROMOTER,
    selectAnalyticsDashboard,
} from './mockAnalytics';
import { HomeView } from './views/HomeView';

export default function AnalyticsDashboardApp({ isDark }) {
    const theme = getDashboardTheme(isDark);
    const [searchParams, setSearchParams] = useSearchParams();

    const pageId = searchParams.get('page') || DEFAULT_PAGE_ID;
    const range = searchParams.get('range') || DEFAULT_RANGE;

    const dashboard = useMemo(
        () => selectAnalyticsDashboard({ pageId, range }),
        [pageId, range]
    );

    const onFiltersChange = ({ pageId: nextPageId, range: nextRange }) => {
        const next = new URLSearchParams(searchParams);
        if (!nextPageId || nextPageId === DEFAULT_PAGE_ID) next.delete('page');
        else next.set('page', nextPageId);
        if (!nextRange || nextRange === DEFAULT_RANGE) next.delete('range');
        else next.set('range', nextRange);
        setSearchParams(next, { replace: true });
    };

    return (
        <DashboardPage className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className={cn('text-2xl font-light tracking-tight sm:text-3xl', theme.textPrimary)}>Analytics</h1>
                        <DashboardChip isDark={isDark}>Mock data</DashboardChip>
                    </div>
                    <p className={cn('mt-1 text-sm font-light', theme.textSecondary)}>
                        {MOCK_PROMOTER}. Demo numbers only.
                    </p>
                </div>
            </div>

            <FilterBar
                isDark={isDark}
                pageId={dashboard.pageId}
                range={dashboard.range}
                pages={dashboard.pages}
                onChange={onFiltersChange}
                liveNow={dashboard.liveNow}
            />

            {dashboard.empty ? (
                <DashboardEmptyState
                    isDark={isDark}
                    title={dashboard.emptyMessage}
                    description="Pick another page, or check back after people start visiting."
                />
            ) : (
                <HomeView isDark={isDark} dashboard={dashboard} />
            )}
        </DashboardPage>
    );
}
