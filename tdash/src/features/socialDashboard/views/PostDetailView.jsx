import React from 'react';
import { Link } from 'react-router-dom';
import {
    DashboardChip,
    DashboardEmptyState,
    DashboardSection,
    DashboardSurface,
} from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { PostThumbnail } from '../components/PostThumbnail';
import { CommentList } from '../components/CommentList';
import { getAccountById, getPostById } from '../mockData';
import { fanMood, howItCompares, likesCommentsShares, openOnLabel, peopleReachedValue, NOT_AVAILABLE } from '../plainCopy';
import { formatNumber } from '../formatters';

export const PostDetailView = ({ isDark, postId, href }) => {
    const theme = getDashboardTheme(isDark);
    const post = getPostById(postId);

    if (!post) {
        return <DashboardEmptyState isDark={isDark} title="That post is not in this demo" description="Try another post from Home or Posts." action={<Link to={href('posts')} className="text-pink-400">Back to posts</Link>} />;
    }

    const account = getAccountById(post.accountId);
    const reached = peopleReachedValue(post);
    const mood = fanMood(post);
    const loved = post.comments.filter((comment) => comment.sentiment === 'positive').slice(0, 3);
    const complained = post.comments.filter((comment) => comment.sentiment === 'negative' || comment.sentiment === 'mixed').slice(0, 3);
    const asked = post.comments.filter((comment) => comment.isQuestion).slice(0, 3);

    const numbers = [
        { label: 'People reached', value: reached === null ? NOT_AVAILABLE : formatNumber(reached) },
        { label: 'Likes, comments & shares', value: formatNumber(likesCommentsShares(post)) },
        { label: 'New followers', value: NOT_AVAILABLE },
        { label: 'Link clicks', value: post.clicks.state === 'ok' ? formatNumber(post.clicks.value) : NOT_AVAILABLE },
    ];

    return (
        <div className="space-y-6">
            <DashboardSection
                isDark={isDark}
                accent="brand"
                title={post.thumbnailLabel}
                description={post.caption}
                actions={(
                    <div className="flex flex-wrap gap-2">
                        <Link to={href('posts')} className="text-sm text-pink-400">All posts</Link>
                        <a href={post.mockPermalink} className="text-sm text-pink-400" onClick={(event) => event.preventDefault()}>{openOnLabel(post.platform)}</a>
                    </div>
                )}
            >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
                    <PostThumbnail post={post} />
                    <div>
                        <DashboardChip isDark={isDark}>{account?.handle}</DashboardChip>
                        <p className={cn('mt-4 text-lg font-light', theme.textPrimary)}>{howItCompares(post)}</p>
                        <p className={cn('mt-2 text-sm', theme.textSecondary)}>
                            {mood.label}
                            {post.classifiedComments ? ` · ${post.positiveComments} loved it · ${post.negativeComments} complained · ${asked.length} asked a question` : ''}
                        </p>
                    </div>
                </div>
            </DashboardSection>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {numbers.map((item) => (
                    <DashboardSurface key={item.label} isDark={isDark} accent="slate" className="p-4">
                        <p className={cn('text-sm', theme.textSecondary)}>{item.label}</p>
                        <p className={cn('mt-2 text-2xl font-light', theme.textPrimary)}>{item.value}</p>
                    </DashboardSurface>
                ))}
            </div>

            <DashboardSection isDark={isDark} accent="green" title="What fans loved">
                <CommentList isDark={isDark} comments={loved} emptyTitle="No praise on this post yet" replyStub />
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="brand" title="What fans complained about">
                <CommentList isDark={isDark} comments={complained} emptyTitle="No complaints on this post" replyStub />
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="amber" title="Questions fans asked">
                <CommentList isDark={isDark} comments={asked} emptyTitle="No questions on this post" replyStub />
            </DashboardSection>
        </div>
    );
};
