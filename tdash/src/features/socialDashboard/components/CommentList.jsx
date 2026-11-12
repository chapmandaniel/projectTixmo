import React from 'react';
import { DashboardChip, DashboardEmptyState } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { formatDateTime } from '../formatters';

export const CommentList = ({ isDark, comments, emptyTitle = 'No comments in this filter' }) => {
    const theme = getDashboardTheme(isDark);
    if (!comments.length) {
        return <DashboardEmptyState isDark={isDark} compact title={emptyTitle} description="This mock extract has no matching comments for the active theme or sentiment filter." />;
    }

    return (
        <ul className="space-y-3">
            {comments.map((comment) => (
                <li key={comment.id} className={cn('rounded-md border p-3', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                    <div className="flex flex-wrap items-center gap-2">
                        <p className={cn('text-sm', theme.textPrimary)}>{comment.author}</p>
                        <DashboardChip isDark={isDark}>{comment.sentiment}</DashboardChip>
                        <DashboardChip isDark={isDark}>{comment.theme}</DashboardChip>
                        {comment.isQuestion ? <DashboardChip isDark={isDark}>Question</DashboardChip> : null}
                        {comment.teamReplied ? <DashboardChip isDark={isDark}>Team replied</DashboardChip> : null}
                    </div>
                    <p className={cn('mt-2 text-sm font-light leading-6', theme.textSecondary)}>{comment.text}</p>
                    <p className={cn('mt-2 text-[11px]', theme.textMuted)}>
                        {formatDateTime(comment.createdAt)} · {comment.reactions} reactions · mock comment
                    </p>
                </li>
            ))}
        </ul>
    );
};
