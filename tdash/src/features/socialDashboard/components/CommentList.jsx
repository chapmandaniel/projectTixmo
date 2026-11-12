import React from 'react';
import { DashboardEmptyState } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { formatDateTime } from '../formatters';

export const CommentList = ({ isDark, comments, emptyTitle = 'Nothing here yet', replyStub = false }) => {
    const theme = getDashboardTheme(isDark);
    if (!comments.length) {
        return <DashboardEmptyState isDark={isDark} compact title={emptyTitle} description="Nothing in this demo extract yet." />;
    }

    return (
        <ul className="space-y-3">
            {comments.map((comment) => (
                <li key={comment.id} className={cn('rounded-md border p-3', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                    <p className={cn('text-sm', theme.textPrimary)}>{comment.author}</p>
                    <p className={cn('mt-2 text-sm font-light leading-6', theme.textSecondary)}>{comment.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                        <p className={cn('text-[11px]', theme.textMuted)}>{formatDateTime(comment.createdAt)}</p>
                        {replyStub ? (
                            <button type="button" className="text-xs text-pink-400" onClick={() => {}}>Reply</button>
                        ) : null}
                    </div>
                </li>
            ))}
        </ul>
    );
};
