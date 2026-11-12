import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardButton, DashboardSection, DashboardSelect } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { PostCard } from '../components/PostCard';
import { DataStateBadge } from '../components/DataStateBadge';
import { engagementRateByReach, engagementTotal, getAccountById, positiveShare } from '../mockData';
import { formatDateTime, formatNumber, formatPercent } from '../formatters';

const SORTS = [
    { id: 'recency', label: 'Recency' },
    { id: 'reach', label: 'Reach' },
    { id: 'shares', label: 'Shares' },
    { id: 'saves', label: 'Saves' },
    { id: 'rate', label: 'Engagement rate' },
    { id: 'clicks', label: 'Clicks' },
    { id: 'comments', label: 'Comment volume' },
];

const sortPosts = (posts, sort) => [...posts].sort((a, b) => {
    if (sort === 'recency') return b.publishedAt.localeCompare(a.publishedAt);
    if (sort === 'reach') return (b.reach.value || 0) - (a.reach.value || 0);
    if (sort === 'shares') return b.shares - a.shares;
    if (sort === 'saves') return (b.saves.value || 0) - (a.saves.value || 0);
    if (sort === 'rate') return (engagementRateByReach(b) || 0) - (engagementRateByReach(a) || 0);
    if (sort === 'clicks') return (b.clicks.value || 0) - (a.clicks.value || 0);
    return b.commentsCount - a.commentsCount;
});

export const PostsView = ({ isDark, dashboard, href, compareIds, onToggleCompare }) => {
    const theme = getDashboardTheme(isDark);
    const [mode, setMode] = useState('gallery');
    const [sort, setSort] = useState('recency');
    const posts = useMemo(() => sortPosts(dashboard.posts, sort), [dashboard.posts, sort]);
    const compared = posts.filter((post) => compareIds.includes(post.id));

    return (
        <div className="space-y-6">
            <DashboardSection
                isDark={isDark}
                accent="violet"
                title="All posts"
                description="Card gallery for browsing. Table for sorting at scale. Compare up to three posts with the same metric definitions."
                actions={(
                    <div className="flex flex-wrap items-center gap-2">
                        <DashboardSelect isDark={isDark} value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 w-44">
                            {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                        </DashboardSelect>
                        <DashboardButton isDark={isDark} variant={mode === 'gallery' ? 'primary' : 'secondary'} onClick={() => setMode('gallery')}>Gallery</DashboardButton>
                        <DashboardButton isDark={isDark} variant={mode === 'table' ? 'primary' : 'secondary'} onClick={() => setMode('table')}>Table</DashboardButton>
                    </div>
                )}
            >
                {mode === 'gallery' ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {posts.map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                isDark={isDark}
                                to={href(`posts/${post.id}`)}
                                selected={compareIds.includes(post.id)}
                                onToggleCompare={onToggleCompare}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead>
                                <tr className={cn('text-[10px] uppercase tracking-[0.14em]', theme.textTertiary)}>
                                    <th className="py-2 pr-3">Post</th>
                                    <th className="py-2 pr-3">Reach</th>
                                    <th className="py-2 pr-3">Engagements</th>
                                    <th className="py-2 pr-3">Rate</th>
                                    <th className="py-2 pr-3">Response</th>
                                    <th className="py-2 pr-3">Published</th>
                                    <th className="py-2">Compare</th>
                                </tr>
                            </thead>
                            <tbody>
                                {posts.map((post) => {
                                    const rate = engagementRateByReach(post);
                                    const response = positiveShare(post);
                                    return (
                                        <tr key={post.id} className={cn('border-t', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                                            <td className="py-3 pr-3">
                                                <Link to={href(`posts/${post.id}`)} className={theme.textPrimary}>{post.thumbnailLabel}</Link>
                                                <p className={cn('text-xs', theme.textMuted)}>{post.platform} · {post.format} · {post.distribution}</p>
                                            </td>
                                            <td className="py-3 pr-3">{post.reach.state === 'ok' ? formatNumber(post.reach.value) : <DataStateBadge state={post.reach.state} />}</td>
                                            <td className="py-3 pr-3">{formatNumber(engagementTotal(post))}</td>
                                            <td className="py-3 pr-3">{rate === null ? '—' : formatPercent(rate)}</td>
                                            <td className="py-3 pr-3">{response === null ? `${post.classifiedComments} classified` : formatPercent(response, 0)}</td>
                                            <td className="py-3 pr-3">{formatDateTime(post.publishedAt)}</td>
                                            <td className="py-3">
                                                <input type="checkbox" checked={compareIds.includes(post.id)} onChange={() => onToggleCompare(post.id)} aria-label={`Compare ${post.thumbnailLabel}`} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </DashboardSection>

            {compared.length > 0 ? (
                <DashboardSection isDark={isDark} accent="brand" title="Compare" description="Same metric definitions, mixed formats labelled. Maximum three posts.">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {compared.map((post) => {
                            const account = getAccountById(post.accountId);
                            const rate = engagementRateByReach(post);
                            return (
                                <div key={post.id} className={cn('rounded-md border p-4', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                                    <p className={theme.textPrimary}>{post.thumbnailLabel}</p>
                                    <p className={cn('text-xs', theme.textMuted)}>{account?.handle} · {post.format}</p>
                                    <dl className="mt-3 space-y-1 text-sm">
                                        <div className="flex justify-between"><dt>Reach</dt><dd>{post.reach.value ?? 'Unavailable'}</dd></div>
                                        <div className="flex justify-between"><dt>Interactions</dt><dd>{engagementTotal(post)}</dd></div>
                                        <div className="flex justify-between"><dt>Rate by reach</dt><dd>{rate === null ? '—' : formatPercent(rate)}</dd></div>
                                        <div className="flex justify-between"><dt>Comments</dt><dd>{post.commentsCount}</dd></div>
                                    </dl>
                                    <Link to={href(`posts/${post.id}`)} className="mt-3 inline-block text-sm text-pink-400">Open post</Link>
                                </div>
                            );
                        })}
                    </div>
                </DashboardSection>
            ) : null}
        </div>
    );
};
