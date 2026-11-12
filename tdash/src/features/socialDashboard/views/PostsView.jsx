import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardButton, DashboardSection, DashboardSelect } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { PostCard } from '../components/PostCard';
import { getAccountById } from '../mockData';
import { exportPostsCsv } from '../exportPostsCsv';
import { fanMood, likesCommentsShares, peopleReachedValue, usualBadge, NOT_AVAILABLE } from '../plainCopy';
import { formatDateTime, formatNumber } from '../formatters';

const SORTS = [
    { id: 'newest', label: 'Newest' },
    { id: 'reached', label: 'Most reached' },
    { id: 'engagement', label: 'Most engagement' },
    { id: 'comments', label: 'Most comments' },
];

const sortPosts = (posts, sort) => [...posts].sort((a, b) => {
    if (sort === 'reached') return (b.reach.value || 0) - (a.reach.value || 0);
    if (sort === 'engagement') return likesCommentsShares(b) - likesCommentsShares(a);
    if (sort === 'comments') return b.commentsCount - a.commentsCount;
    return b.publishedAt.localeCompare(a.publishedAt);
});

export const PostsView = ({ isDark, dashboard, href, compareIds, onToggleCompare }) => {
    const theme = getDashboardTheme(isDark);
    const [mode, setMode] = useState('gallery');
    const [sort, setSort] = useState('newest');
    const posts = useMemo(() => sortPosts(dashboard.posts, sort), [dashboard.posts, sort]);
    const compared = posts.filter((post) => compareIds.includes(post.id)).slice(0, 2);

    return (
        <div className="space-y-6">
            <DashboardSection
                isDark={isDark}
                accent="violet"
                title="Posts"
                actions={(
                    <div className="flex flex-wrap items-center gap-2">
                        <DashboardSelect isDark={isDark} value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 w-44">
                            {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                        </DashboardSelect>
                        <DashboardButton isDark={isDark} variant={mode === 'gallery' ? 'primary' : 'secondary'} onClick={() => setMode('gallery')}>Cards</DashboardButton>
                        <DashboardButton isDark={isDark} variant={mode === 'table' ? 'primary' : 'secondary'} onClick={() => setMode('table')}>Table</DashboardButton>
                        <DashboardButton isDark={isDark} variant="secondary" onClick={() => exportPostsCsv(posts)}>Download</DashboardButton>
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
                                    <th className="py-2 pr-3">Account</th>
                                    <th className="py-2 pr-3">Date</th>
                                    <th className="py-2 pr-3">People reached</th>
                                    <th className="py-2 pr-3">Likes, comments & shares</th>
                                    <th className="py-2 pr-3">Link clicks</th>
                                    <th className="py-2 pr-3">Badge</th>
                                    <th className="py-2 pr-3">Fan mood</th>
                                    <th className="py-2">Compare</th>
                                </tr>
                            </thead>
                            <tbody>
                                {posts.map((post) => {
                                    const reached = peopleReachedValue(post);
                                    return (
                                        <tr key={post.id} className={cn('border-t', isDark ? 'border-dashboard-border' : 'border-slate-200')}>
                                            <td className="py-3 pr-3">
                                                <Link to={href(`posts/${post.id}`)} className={theme.textPrimary}>{post.thumbnailLabel}</Link>
                                            </td>
                                            <td className="py-3 pr-3">{getAccountById(post.accountId)?.handle}</td>
                                            <td className="py-3 pr-3">{formatDateTime(post.publishedAt)}</td>
                                            <td className="py-3 pr-3">{reached === null ? NOT_AVAILABLE : formatNumber(reached)}</td>
                                            <td className="py-3 pr-3">{formatNumber(likesCommentsShares(post))}</td>
                                            <td className="py-3 pr-3">{post.clicks.state === 'ok' ? formatNumber(post.clicks.value) : NOT_AVAILABLE}</td>
                                            <td className="py-3 pr-3">{usualBadge(post).label}</td>
                                            <td className="py-3 pr-3">{fanMood(post).label}</td>
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
                <DashboardSection isDark={isDark} accent="brand" title="Compare" description="Two posts side by side.">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {compared.map((post) => (
                            <div key={post.id} className={cn('rounded-md border p-4', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                                <p className={theme.textPrimary}>{post.thumbnailLabel}</p>
                                <p className={cn('text-xs', theme.textMuted)}>{getAccountById(post.accountId)?.handle}</p>
                                <p className="mt-3 text-sm">{peopleReachedValue(post) === null ? NOT_AVAILABLE : `${formatNumber(peopleReachedValue(post))} people reached`}</p>
                                <p className={cn('text-sm', theme.textSecondary)}>{formatNumber(likesCommentsShares(post))} likes, comments & shares</p>
                                <p className="mt-2 text-sm">{usualBadge(post).label} · {fanMood(post).label}</p>
                                <Link to={href(`posts/${post.id}`)} className="mt-3 inline-block text-sm text-pink-400">Open post</Link>
                            </div>
                        ))}
                    </div>
                </DashboardSection>
            ) : null}
        </div>
    );
};
