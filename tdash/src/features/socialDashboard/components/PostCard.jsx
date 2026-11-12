import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardChip, DashboardSurface } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { getAccountById } from '../mockData';
import { fanMood, likesCommentsShares, peopleReachedValue, usualBadge, NOT_AVAILABLE } from '../plainCopy';
import { formatNumber } from '../formatters';
import { PostThumbnail } from './PostThumbnail';

export const PostCard = ({ post, to, isDark, selected = false, onToggleCompare, compact = false }) => {
    const theme = getDashboardTheme(isDark);
    const account = getAccountById(post.accountId);
    const reached = peopleReachedValue(post);
    const badge = usualBadge(post);
    const mood = fanMood(post);

    return (
        <DashboardSurface isDark={isDark} accent={selected ? 'brand' : 'slate'} className={cn('flex h-full flex-col p-3', selected && 'ring-1 ring-pink-400/40')}>
            <Link to={to} className="block outline-hidden focus-visible:ring-2 focus-visible:ring-pink-400">
                <PostThumbnail post={post} className={compact ? 'max-h-40' : ''} />
            </Link>
            <Link to={to} className="mt-3 block" data-testid={`post-card-${post.id}`}>
                <h3 className={cn('text-sm font-light leading-5', theme.textPrimary)}>{post.thumbnailLabel}</h3>
                <p className={cn('mt-1 line-clamp-1 text-xs font-light', theme.textSecondary)}>{post.caption}</p>
                <p className={cn('mt-2 text-[11px]', theme.textMuted)}>{account?.handle}</p>
            </Link>
            <p className={cn('mt-3 text-sm', theme.textPrimary)}>
                {reached === null ? NOT_AVAILABLE : `${formatNumber(reached)} people reached`}
            </p>
            <p className={cn('text-xs font-light', theme.textMuted)}>
                {formatNumber(likesCommentsShares(post))} likes, comments & shares
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
                <DashboardChip isDark={isDark}>{badge.label}</DashboardChip>
                <DashboardChip isDark={isDark}>{mood.label}</DashboardChip>
            </div>
            {onToggleCompare ? (
                <label className={cn('mt-3 inline-flex items-center gap-2 text-xs', theme.textSecondary)}>
                    <input type="checkbox" checked={selected} onChange={() => onToggleCompare(post.id)} />
                    Compare
                </label>
            ) : null}
        </DashboardSurface>
    );
};
