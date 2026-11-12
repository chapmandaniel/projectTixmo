import React, { useCallback, useMemo } from 'react';
import { NavLink, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import {
    DashboardChip,
    DashboardPage,
    DashboardPageHeader,
} from '../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';
import { isSocialDashboardAnalystViewsEnabled } from './flag';
import { FilterBar } from './components/FilterBar';
import { MOCK_BRAND, selectDashboard } from './mockData';
import { HomeView } from './views/HomeView';
import { PostsView } from './views/PostsView';
import { PostDetailView } from './views/PostDetailView';
import { FansView } from './views/FansView';
import { AccountsView } from './views/AccountsView';
import { OverviewView } from './views/OverviewView';
import { ContentView } from './views/ContentView';
import { AudienceView } from './views/AudienceView';
import { CommunityView } from './views/CommunityView';
import { ListeningView } from './views/ListeningView';
import { CompetitorsView } from './views/CompetitorsView';
import { PaidView } from './views/PaidView';
import { ReportsView } from './views/ReportsView';

const NAV = [
    { to: '', label: 'Home' },
    { to: 'posts', label: 'Posts' },
    { to: 'fans', label: 'Fans' },
    { to: 'accounts', label: 'Accounts' },
];

const ANALYST_NAV = [
    { to: 'overview', label: 'Overview (hidden)' },
    { to: 'content', label: 'Content' },
    { to: 'audience', label: 'Audience' },
    { to: 'community', label: 'Community' },
    { to: 'listening', label: 'Listening' },
    { to: 'competitors', label: 'Competitors' },
    { to: 'paid', label: 'Paid vs organic' },
    { to: 'reports', label: 'Reports' },
];

export default function SocialDashboardApp({ isDark, basePath = '/social' }) {
    const theme = getDashboardTheme(isDark);
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${location.pathname}${location.search}`;
    const analystViews = isSocialDashboardAnalystViewsEnabled();

    const filters = {
        accountId: searchParams.get('account') || 'all',
        range: searchParams.get('range') || '28',
        platform: searchParams.get('platform') || 'all',
        distribution: searchParams.get('distribution') || 'all',
        format: searchParams.get('format') || 'all',
        theme: searchParams.get('theme') || '',
    };

    const compareIds = (searchParams.get('compare') || '').split(',').filter(Boolean);

    const dashboard = useMemo(
        () => selectDashboard(filters),
        [filters.accountId, filters.range, filters.platform, filters.distribution, filters.format, filters.theme],
    );

    const updateParams = useCallback((patch) => {
        const next = new URLSearchParams(searchParams);
        Object.entries(patch).forEach(([key, value]) => {
            if (!value || value === 'all') next.delete(key);
            else next.set(key, value);
        });
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const onFiltersChange = (nextFilters) => {
        updateParams({
            account: nextFilters.accountId,
            range: String(nextFilters.range || '28') === '28' ? '' : String(nextFilters.range),
        });
    };

    const onToggleCompare = (postId) => {
        const selected = new Set(compareIds);
        if (selected.has(postId)) selected.delete(postId);
        else if (selected.size < 2) selected.add(postId);
        updateParams({ compare: [...selected].join(',') });
    };

    const href = (path) => {
        const [pathname, extra] = path.split('?');
        const next = new URLSearchParams(searchParams);
        if (extra) {
            new URLSearchParams(extra).forEach((value, key) => next.set(key, value));
        }
        const suffix = pathname ? `/${pathname}` : '';
        const query = next.toString();
        return `${basePath}${suffix}${query ? `?${query}` : ''}`;
    };

    const navClass = ({ isActive }) => cn(
        'rounded-md px-3 py-2 text-sm font-light',
        isActive
            ? (isDark ? 'bg-dashboard-control text-white' : 'bg-slate-900 text-white')
            : theme.navItem
    );

    const visibleNav = analystViews ? [...NAV, ...ANALYST_NAV] : NAV;

    return (
        <DashboardPage className="space-y-6">
            <div
                data-testid="social-dashboard-url"
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
                title="Social"
                description={`${MOCK_BRAND}. Demo numbers only.`}
                icon={Share2}
                iconClassName="text-fuchsia-300"
                badges={(
                    <>
                        <DashboardChip isDark={isDark}>Mock data</DashboardChip>
                        <DashboardChip isDark={isDark} className="max-w-full break-all">{publicUrl}</DashboardChip>
                    </>
                )}
            />

            <FilterBar isDark={isDark} filters={filters} onChange={onFiltersChange} />

            <nav aria-label="Social dashboard" className="flex flex-wrap gap-1">
                {visibleNav.map((item) => (
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

            <Routes>
                <Route index element={<HomeView isDark={isDark} dashboard={dashboard} href={href} />} />
                <Route
                    path="posts"
                    element={(
                        <PostsView
                            isDark={isDark}
                            dashboard={dashboard}
                            href={href}
                            compareIds={compareIds}
                            onToggleCompare={onToggleCompare}
                        />
                    )}
                />
                <Route path="posts/:postId" element={<PostDetailRoute isDark={isDark} href={href} />} />
                <Route path="fans" element={<FansView isDark={isDark} href={href} />} />
                <Route path="accounts" element={<AccountsView isDark={isDark} dashboard={dashboard} />} />
                {analystViews ? (
                    <>
                        <Route path="overview" element={<OverviewView isDark={isDark} dashboard={dashboard} href={href} />} />
                        <Route path="content" element={<ContentView isDark={isDark} dashboard={dashboard} href={href} />} />
                        <Route path="audience" element={<AudienceView isDark={isDark} dashboard={dashboard} />} />
                        <Route path="community" element={<CommunityView isDark={isDark} href={href} />} />
                        <Route path="listening" element={<ListeningView isDark={isDark} dashboard={dashboard} />} />
                        <Route path="competitors" element={<CompetitorsView isDark={isDark} dashboard={dashboard} />} />
                        <Route path="paid" element={<PaidView isDark={isDark} />} />
                        <Route path="reports" element={<ReportsView isDark={isDark} dashboard={dashboard} href={href} />} />
                    </>
                ) : null}
            </Routes>
        </DashboardPage>
    );
}

const PostDetailRoute = ({ isDark, href }) => {
    const { postId } = useParams();
    return <PostDetailView isDark={isDark} postId={postId} href={href} />;
};
