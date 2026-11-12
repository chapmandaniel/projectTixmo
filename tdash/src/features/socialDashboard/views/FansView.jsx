import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DashboardButton, DashboardSection } from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { COMMUNITY, FAN_MENTIONS, POSTS, getPostById } from '../mockData';
import { commentAge } from '../plainCopy';

const TABS = [
    { id: 'needs-reply', label: 'Needs reply' },
    { id: 'complaints', label: 'Complaints' },
    { id: 'questions', label: 'Questions' },
    { id: 'praise', label: 'Praise' },
    { id: 'mentions', label: 'Mentions' },
];

const allComments = POSTS.flatMap((post) => post.comments.map((comment) => ({ ...comment, postTitle: post.thumbnailLabel })));

export const FansView = ({ isDark, href }) => {
    const theme = getDashboardTheme(isDark);
    const [params, setParams] = useSearchParams();
    const tab = TABS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'needs-reply';
    const [handled, setHandled] = useState(() => new Set());

    const unanswered = allComments.filter((comment) => comment.isQuestion && !comment.teamReplied).length;

    const rows = useMemo(() => {
        if (tab === 'mentions') {
            return FAN_MENTIONS.map((mention) => ({
                id: mention.id,
                text: mention.text,
                author: mention.author,
                createdAt: `${mention.date}T12:00:00-03:30`,
                postTitle: mention.postTitle,
                postId: mention.postId,
            }));
        }
        return allComments.filter((comment) => {
            if (handled.has(comment.id)) return false;
            if (tab === 'needs-reply') return (comment.isQuestion || comment.sentiment === 'negative') && !comment.teamReplied;
            if (tab === 'complaints') return comment.sentiment === 'negative' || comment.sentiment === 'mixed';
            if (tab === 'questions') return comment.isQuestion;
            if (tab === 'praise') return comment.sentiment === 'positive';
            return true;
        });
    }, [tab, handled]);

    return (
        <div className="space-y-6">
            <DashboardSection
                isDark={isDark}
                accent="green"
                title="Fans"
                description={`${unanswered} unanswered · average reply time ${COMMUNITY.medianFirstReplyMinutes} min`}
            >
                <div className="mb-4 flex flex-wrap gap-2">
                    {TABS.map((item) => (
                        <DashboardButton
                            key={item.id}
                            isDark={isDark}
                            variant={tab === item.id ? 'primary' : 'secondary'}
                            onClick={() => {
                                const next = new URLSearchParams(params);
                                next.set('tab', item.id);
                                setParams(next, { replace: true });
                            }}
                        >
                            {item.label}
                        </DashboardButton>
                    ))}
                </div>
                {tab === 'mentions' ? (
                    <p className={cn('mb-4 text-sm font-light', theme.textSecondary)}>Posts by other people that mention the festival.</p>
                ) : null}
                <ul className="space-y-3">
                    {rows.map((row) => (
                        <li key={row.id} className={cn('rounded-md border p-4', isDark ? 'border-dashboard-border bg-dashboard-panelMuted' : 'border-slate-200 bg-slate-50')}>
                            <p className={cn('text-sm font-light leading-6', theme.textPrimary)}>{row.text}</p>
                            <p className={cn('mt-2 text-xs', theme.textMuted)}>
                                {row.author} · on {getPostById(row.postId)?.thumbnailLabel || row.postTitle} · {commentAge(row.createdAt)}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-3">
                                <Link to={href(`posts/${row.postId}`)} className="text-sm text-pink-400">Open post</Link>
                                {tab !== 'mentions' ? (
                                    <button
                                        type="button"
                                        className="text-sm text-pink-400"
                                        onClick={() => setHandled((current) => new Set(current).add(row.id))}
                                    >
                                        Mark handled
                                    </button>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ul>
                {rows.length === 0 ? (
                    <p className={cn('text-sm', theme.textSecondary)}>Nothing in this list right now.</p>
                ) : null}
            </DashboardSection>
        </div>
    );
};
