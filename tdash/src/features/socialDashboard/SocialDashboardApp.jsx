import React, { useCallback, useMemo } from 'react';
import { NavLink, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import {
    DashboardChip,
    DashboardPage,
    DashboardPageHeader,
} from '../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../lib/dashboardTheme';
import { cn } from '../../lib/utils';
import { FilterBar } from './components/FilterBar';
import { MOCK_BRAND, selectDashboard } from './mockData';
import { OverviewView } from './views/OverviewView';
import { PostsView } from './views/PostsView';
import { PostDetailView } from './views/PostDetailView';
import { PrototypeStubView } from './views/StubViews';

const NAV = [
    { to: '', label: 'Overview' },
    { to: 'posts', label: 'Posts' },
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
    const [searchParams, setSearchParams] = useSearchParams();

    const filters = {
        accountId: searchParams.get('account') || 'all',
        platform: searchParams.get('platform') || 'all',
        distribution: searchParams.get('distribution') || 'all',
        format: searchParams.get('format') || 'all',
        theme: searchParams.get('theme') || '',
    };

    const compareIds = (searchParams.get('compare') || '').split(',').filter(Boolean);

    const dashboard = useMemo(() => selectDashboard(filters), [filters.accountId, filters.platform, filters.distribution, filters.format, filters.theme]);

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
            platform: nextFilters.platform,
            distribution: nextFilters.distribution,
        });
    };

    const onToggleCompare = (postId) => {
        const selected = new Set(compareIds);
        if (selected.has(postId)) selected.delete(postId);
        else if (selected.size < 3) selected.add(postId);
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

    return (
        <DashboardPage className="space-y-6">
            <DashboardPageHeader
                isDark={isDark}
                eyebrow="Labs prototype"
                title="Social dashboard"
                description={`${MOCK_BRAND}. Mock accounts, posts and comments only. No live tokens, no customer data, no API calls.`}
                icon={Share2}
                iconClassName="text-fuchsia-300"
                badges={(
                    <>
                        <DashboardChip isDark={isDark}>Mock data</DashboardChip>
                        <DashboardChip isDark={isDark}>Not connected</DashboardChip>
                    </>
                )}
            />

            <FilterBar isDark={isDark} filters={filters} onChange={onFiltersChange} />

            <nav aria-label="Social dashboard" className="flex flex-wrap gap-1">
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

            <Routes>
                <Route index element={<OverviewView isDark={isDark} dashboard={dashboard} href={href} />} />
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
                <Route
                    path="posts/:postId"
                    element={<PostDetailRoute isDark={isDark} href={href} searchParams={searchParams} updateParams={updateParams} />}
                />
                <Route path="content" element={<PrototypeStubView isDark={isDark} title="Content, campaigns, and creative" description="Formats, themes, timing heatmap and video land in the next pass." />} />
                <Route path="audience" element={<PrototypeStubView isDark={isDark} title="Audience and growth" description="Follower line, net-change bars and labelled demographics land in the next pass." />} />
                <Route path="community" element={<PrototypeStubView isDark={isDark} title="Community and audience response" description="Volume, sentiment coverage, responsiveness and resolution land in the next pass." />} />
                <Route path="listening" element={<PrototypeStubView isDark={isDark} title="Social listening and brand health" description="Mentions timeline, topics, spike drill-down and share of voice land in the next pass." />} />
                <Route path="competitors" element={<PrototypeStubView isDark={isDark} title="Competitors and benchmarks" description="Mock peer table lands in the next pass." />} />
                <Route path="paid" element={<PrototypeStubView isDark={isDark} title="Paid vs organic" description="Spend, CPM, CPC and CTR in CAD land in the next pass." />} />
                <Route path="reports" element={<PrototypeStubView isDark={isDark} title="Sharing and recurring reports" description="Saved-view stub, weekly summary preview and CSV export land in the next pass." />} />
            </Routes>
        </DashboardPage>
    );
}

const PostDetailRoute = ({ isDark, href, searchParams, updateParams }) => {
    const { postId } = useParams();
    return (
        <PostDetailView
            isDark={isDark}
            postId={postId}
            href={href}
            themeFilter={searchParams.get('theme') || ''}
            onThemeFilter={(theme) => updateParams({ theme })}
        />
    );
};
