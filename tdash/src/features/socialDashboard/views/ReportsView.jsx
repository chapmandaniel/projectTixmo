import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardButton, DashboardChip, DashboardSection } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { CURRENT_RANGE, MOCK_BRAND, POSTS, REPORT_TIMEZONE, SAVED_VIEWS, engagementTotal } from '../mockData';
import { PostThumbnail } from '../components/PostThumbnail';
import { formatNumber } from '../formatters';

const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const exportPostCsv = (posts) => {
    const header = ['id', 'platform', 'accountId', 'format', 'distribution', 'publishedAt', 'caption', 'reach', 'impressions', 'likes', 'comments', 'shares', 'saves', 'clicks', 'campaign'];
    const lines = [
        header.join(','),
        ...posts.map((post) => [
            post.id,
            post.platform,
            post.accountId,
            post.format,
            post.distribution,
            post.publishedAt,
            post.caption,
            post.reach.value,
            post.impressions.value,
            post.likes,
            post.commentsCount,
            post.shares,
            post.saves.value,
            post.clicks.value,
            post.campaign,
        ].map(csvEscape).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'northlight-live-demo-posts.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

export const ReportsView = ({ isDark, dashboard, href }) => {
    const theme = getDashboardTheme(isDark);
    const topPosts = [...dashboard.posts].sort((a, b) => engagementTotal(b) - engagementTotal(a)).slice(0, 3);

    return (
        <div className="space-y-6">
            <DashboardSection
                isDark={isDark}
                accent="slate"
                title="Sharing and recurring reports"
                description="Save a report’s metrics, accounts, filters and comparison range. This prototype stores nothing — saved views are stubs."
            >
                <ul className="space-y-3">
                    {SAVED_VIEWS.map((view) => (
                        <li key={view.id} className={cn('flex flex-wrap items-center justify-between gap-3 rounded-md border p-4', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                            <div>
                                <p className={theme.textPrimary}>{view.name}</p>
                                <p className={cn('text-xs', theme.textMuted)}>{view.filters}</p>
                            </div>
                            <DashboardChip isDark={isDark}>Stub · not saved</DashboardChip>
                        </li>
                    ))}
                </ul>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                accent="brand"
                title="Weekly summary preview"
                description={`${MOCK_BRAND} · ${CURRENT_RANGE.label} · ${REPORT_TIMEZONE}. Headline change, top posts, leading themes.`}
            >
                <p className={cn('text-sm font-light leading-6', theme.textPrimary)}>
                    Visibility rose versus the prior 28 days, led by seven Instagram Reels. Audience comments still cluster on merch stock and ticket questions.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {topPosts.map((post) => (
                        <Link key={post.id} to={href(`posts/${post.id}`)} className="block">
                            <PostThumbnail post={post} className="h-36" />
                            <p className={cn('mt-2 text-sm', theme.textPrimary)}>{post.thumbnailLabel}</p>
                            <p className={cn('text-xs', theme.textMuted)}>{formatNumber(engagementTotal(post))} interactions</p>
                        </Link>
                    ))}
                </div>
                <p className={cn('mt-4 text-sm', theme.textSecondary)}>Leading themes: lineup praise, merch stock, transit questions.</p>
                <Link to={href('')} className="mt-2 inline-block text-sm text-pink-400">Open full overview</Link>
            </DashboardSection>

            <DashboardSection
                isDark={isDark}
                accent="violet"
                title="Post-level CSV"
                description="Exports the mock post rows currently in memory. Definitions and filters are not persisted server-side."
                actions={(
                    <DashboardButton isDark={isDark} variant="primary" onClick={() => exportPostCsv(dashboard.posts.length ? dashboard.posts : POSTS)}>
                        Export CSV
                    </DashboardButton>
                )}
            >
                <p className={cn('text-sm font-light', theme.textSecondary)}>
                    {dashboard.posts.length} mock rows. Columns include platform, format, distribution, reach, impressions, engagements parts, clicks and campaign.
                </p>
            </DashboardSection>
        </div>
    );
};
