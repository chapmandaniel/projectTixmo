import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardChip, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { engagementRateByReach, engagementTotal, getAccountById, positiveShare } from '../mockData';
import { formatDateTime, formatNumber, formatPercent } from '../formatters';
import { DataStateBadge } from './DataStateBadge';
import { PostThumbnail } from './PostThumbnail';

export const PostCard = ({ post, to, isDark, selected = false, onToggleCompare, compact = false }) => {
    const theme = getDashboardTheme(isDark);
    const account = getAccountById(post.accountId);
    const rate = engagementRateByReach(post);
    const response = positiveShare(post);
    const performanceLabel = post.buildingBaseline
        ? 'Building baseline'
        : rate === null
            ? 'Unavailable'
            : `${formatPercent(rate)} by reach · ${post.percentile}th of ${post.cohortSize}`;

    return (
        <DashboardSurface isDark={isDark} accent={selected ? 'brand' : 'slate'} className={cn('flex h-full flex-col p-3', selected && 'ring-1 ring-pink-400/40')}>
            <Link to={to} className="block outline-hidden focus-visible:ring-2 focus-visible:ring-pink-400">
                <PostThumbnail post={post} className={compact ? 'max-h-40' : ''} />
            </Link>
            <div className="mt-3 flex flex-wrap gap-2">
                <DashboardChip isDark={isDark}>{post.platform}</DashboardChip>
                <DashboardChip isDark={isDark}>{post.distribution}</DashboardChip>
                {post.campaign ? <DashboardChip isDark={isDark}>{post.campaign}</DashboardChip> : null}
            </div>
            <Link to={to} className="mt-2 block" data-testid={`post-card-${post.id}`}>
                <h3 className={cn('text-sm font-light leading-5', theme.textPrimary)}>{post.thumbnailLabel}</h3>
                <p className={cn('mt-1 line-clamp-2 text-xs font-light', theme.textSecondary)}>{post.caption}</p>
                <p className={cn('mt-2 text-[11px]', theme.textMuted)}>
                    {account?.handle} · {formatDateTime(post.publishedAt)}
                </p>
            </Link>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className={cn('rounded-md border p-2', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                    <p className={theme.textMuted}>Performance</p>
                    <p className={cn('mt-1 font-light', theme.textPrimary)}>{performanceLabel}</p>
                    {post.buildingBaseline ? <DataStateBadge state="building" className="mt-1" /> : null}
                </div>
                <div className={cn('rounded-md border p-2', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                    <p className={theme.textMuted}>Audience response</p>
                    <p className={cn('mt-1 font-light', theme.textPrimary)}>
                        {response === null
                            ? (post.classifiedComments < 20 ? `${post.classifiedComments} classified` : 'Unavailable')
                            : `${formatPercent(response, 0)} positive`}
                    </p>
                    <p className={cn('mt-1 text-[11px]', theme.textMuted)}>
                        {post.classifiedComments} of {post.eligibleComments} eligible
                    </p>
                </div>
            </div>
            <p className={cn('mt-3 text-xs font-light', theme.textSecondary)}>
                {formatNumber(post.reach.value)} reach · {formatNumber(engagementTotal(post))} interactions
            </p>
            {onToggleCompare ? (
                <label className={cn('mt-3 inline-flex items-center gap-2 text-xs', theme.textSecondary)}>
                    <input type="checkbox" checked={selected} onChange={() => onToggleCompare(post.id)} />
                    Compare
                </label>
            ) : null}
        </DashboardSurface>
    );
};
