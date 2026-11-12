import React, { useCallback, useMemo } from 'react';
import { NavLink, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import {
    DashboardChip,
    DashboardEmptyState,
    DashboardPage,
    DashboardPageHeader,
} from '../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';
import { FilterBar } from './components/FilterBar';
import {
    DEFAULT_EVENT_ID,
    DEFAULT_RANGE,
    MOCK_PROMOTER,
    selectAnalyticsDashboard,
} from './mockAnalytics';
import { HomeView } from './views/HomeView';
import { TicketPathView } from './views/TicketPathView';
import { ChannelsView } from './views/ChannelsView';

const NAV = [
    { to: '', label: 'Home' },
    { to: 'ticket-path', label: 'Ticket path' },
    { to: 'where-buyers-came-from', label: 'Where buyers came from' },
];

export default function AnalyticsDashboardApp({ isDark, basePath = '/analytics' }) {
    const theme = getDashboardTheme(isDark);
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${location.pathname}${location.search}`;

    const eventId = searchParams.get('event') || DEFAULT_EVENT_ID;
    const range = searchParams.get('range') || DEFAULT_RANGE;

    const href = useCallback((path) => {
        const next = new URLSearchParams(searchParams);
        const suffix = path ? `/${path}` : '';
        const query = next.toString();
        return `${basePath}${suffix}${query ? `?${query}` : ''}`;
    }, [basePath, searchParams]);

    const dashboard = useMemo(
        () => selectAnalyticsDashboard({ eventId, range, href }),
        [eventId, range, href]
    );

    const onFiltersChange = ({ eventId: nextEventId, range: nextRange }) => {
        const next = new URLSearchParams(searchParams);
        if (!nextEventId || nextEventId === DEFAULT_EVENT_ID) next.delete('event');
        else next.set('event', nextEventId);
        if (!nextRange || nextRange === DEFAULT_RANGE) next.delete('range');
        else next.set('range', nextRange);
        setSearchParams(next, { replace: true });
    };

    const navClass = ({ isActive }) => cn(
        'rounded-md px-3 py-2 text-sm font-light',
        isActive
            ? (isDark ? 'bg-dashboard-control text-white' : 'bg-slate-900 text-white')
            : theme.navItem
    );

    return (
        <DashboardPage className="space-y-6" data-testid="analytics-dashboard">
            <div
                data-testid="analytics-dashboard-url"
                className={cn(
                    'rounded-md border px-3 py-2 font-mono text-xs',
                    isDark ? 'border-dashboard-border bg-dashboard-panelMuted text-zinc-300' : 'border-slate-200 bg-white text-slate-700'
                )}
            >
                {publicUrl}
            </div>
            <DashboardPageHeader
                isDark={isDark}
                eyebrow="Labs prototype"
                title="Analytics"
                description={`${MOCK_PROMOTER}. Demo numbers only.`}
                icon={BarChart3}
                iconClassName="text-fuchsia-300"
                badges={(
                    <>
                        <DashboardChip isDark={isDark}>Mock data</DashboardChip>
                        <DashboardChip isDark={isDark} className="max-w-full break-all">{publicUrl}</DashboardChip>
                    </>
                )}
            />

            <FilterBar
                isDark={isDark}
                eventId={dashboard.eventId}
                range={dashboard.range}
                events={dashboard.events}
                onChange={onFiltersChange}
            />

            <nav aria-label="Analytics dashboard" className="flex flex-wrap gap-1">
                {NAV.map((item) => (
                    <NavLink
                        key={item.label}
                        to={href(item.to)}
                        end={item.to === ''}
                        className={navClass}
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            {dashboard.empty ? (
                <DashboardEmptyState
                    isDark={isDark}
                    title={dashboard.emptyMessage}
                    description="Pick another event, or check back after the first paid tickets."
                    data-testid="analytics-empty"
                />
            ) : (
                <Routes>
                    <Route index element={<HomeView isDark={isDark} dashboard={dashboard} />} />
                    <Route path="ticket-path" element={<TicketPathView isDark={isDark} dashboard={dashboard} />} />
                    <Route path="where-buyers-came-from" element={<ChannelsView isDark={isDark} dashboard={dashboard} />} />
                </Routes>
            )}
        </DashboardPage>
    );
}
