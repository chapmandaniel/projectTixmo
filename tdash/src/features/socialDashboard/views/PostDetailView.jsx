import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveLine } from '@nivo/line';
import {
    DashboardButton,
    DashboardChip,
    DashboardEmptyState,
    DashboardSection,
    DashboardStat,
} from '../../../components/dashboard/DashboardPrimitives';
import { getDashboardTheme } from '../../../lib/dashboardTheme';
import { cn } from '../../../lib/utils';
import { PostThumbnail } from '../components/PostThumbnail';
import { DataStateBadge, MetricReadout } from '../components/DataStateBadge';
import { CommentList } from '../components/CommentList';
import { engagementRateByReach, engagementTotal, getAccountById, getPostById } from '../mockData';
import { formatDateTime, formatNumber, formatPercent } from '../formatters';
import { CHART_COLORS, getChartTheme } from '../chartTheme';

export const PostDetailView = ({ isDark, postId, href, themeFilter, onThemeFilter }) => {
    const theme = getDashboardTheme(isDark);
    const post = getPostById(postId);
    const [commentTab, setCommentTab] = useState('all');

    const comments = useMemo(() => {
        if (!post) return [];
        return post.comments.filter((comment) => {
            if (themeFilter && comment.theme !== themeFilter) return false;
            if (commentTab === 'positive') return comment.sentiment === 'positive';
            if (commentTab === 'negative') return comment.sentiment === 'negative';
            if (commentTab === 'questions') return comment.isQuestion;
            return true;
        });
    }, [post, themeFilter, commentTab]);

    if (!post) {
        return <DashboardEmptyState isDark={isDark} title="Post not in this mock extract" description="The demo catalogue does not include that id." action={<Link to={href('posts')} className="text-pink-400">Back to posts</Link>} />;
    }

    const account = getAccountById(post.accountId);
    const rate = engagementRateByReach(post);
    const coverage = post.eligibleComments ? (post.classifiedComments / post.eligibleComments) * 100 : 0;
    const growthData = [{
        id: 'Impressions since publish',
        data: post.growthSincePublish.map((point) => ({ x: `${point.hour}h`, y: point.impressions })),
    }];
    const retentionData = post.videoRetention
        ? [{ id: 'Retained viewers', data: post.videoRetention.map((point) => ({ x: `${point.t}s`, y: point.retained })) }]
        : [];

    const topPositive = post.comments.filter((comment) => comment.sentiment === 'positive').slice(0, 3);
    const topNegative = post.comments.filter((comment) => comment.sentiment === 'negative').slice(0, 3);
    const topQuestions = post.comments.filter((comment) => comment.isQuestion).slice(0, 3);

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
                        <a href={post.mockPermalink} className="text-sm text-pink-400" onClick={(event) => event.preventDefault()}>Open original post (mock)</a>
                    </div>
                )}
            >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
                    <PostThumbnail post={post} />
                    <div>
                        <div className="flex flex-wrap gap-2">
                            <DashboardChip isDark={isDark}>{post.platform}</DashboardChip>
                            <DashboardChip isDark={isDark}>{post.format}</DashboardChip>
                            <DashboardChip isDark={isDark}>{post.distribution}</DashboardChip>
                            {post.campaign ? <DashboardChip isDark={isDark}>{post.campaign}</DashboardChip> : null}
                            <DashboardChip isDark={isDark}>{account?.handle}</DashboardChip>
                        </div>
                        <p className={cn('mt-3 text-sm font-light', theme.textSecondary)}>Published {formatDateTime(post.publishedAt)} · snapshot {post.snapshotAge}</p>
                        {post.buildingBaseline ? (
                            <div className="mt-4">
                                <DataStateBadge state="building" />
                                <p className={cn('mt-2 text-sm font-light', theme.textSecondary)}>
                                    Live counts are shown. Rank against comparable {post.format}s starts after the 24-hour snapshot and a provisional cohort of 20 posts.
                                </p>
                            </div>
                        ) : (
                            <p className={cn('mt-4 text-sm', theme.textPrimary)}>
                                {rate === null ? 'Engagement rate unavailable' : `${formatPercent(rate)} engagement by reach`}
                                {post.percentile !== null ? ` · ${post.percentile}th percentile of ${post.cohortSize} comparable posts · typical ${formatPercent(post.cohortMedianRate)}` : ''}
                            </p>
                        )}
                    </div>
                </div>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="slate" title="Metric breakdown" description="Activity on this post through last refresh. Reach, saves and clicks keep their native coverage labels.">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div><p className={theme.textMuted}>Reach</p><MetricReadout isDark={isDark} state={post.reach.state} note={post.reach.note}>{formatNumber(post.reach.value)}</MetricReadout></div>
                    <div><p className={theme.textMuted}>Impressions</p><MetricReadout isDark={isDark} state={post.impressions.state} note={post.impressions.note}>{formatNumber(post.impressions.value)}</MetricReadout></div>
                    <div><p className={theme.textMuted}>Views</p><MetricReadout isDark={isDark} state={post.views.state} note={post.views.note}>{formatNumber(post.views.value)}</MetricReadout></div>
                    <div><p className={theme.textMuted}>Clicks</p><MetricReadout isDark={isDark} state={post.clicks.state} note={post.clicks.note}>{formatNumber(post.clicks.value)}</MetricReadout></div>
                    <DashboardStat isDark={isDark} label="Likes" value={formatNumber(post.likes)} />
                    <DashboardStat isDark={isDark} label="Comments (native)" value={formatNumber(post.commentsCount)} />
                    <DashboardStat isDark={isDark} label="Shares" value={formatNumber(post.shares)} />
                    <div><p className={theme.textMuted}>Saves</p><MetricReadout isDark={isDark} state={post.saves.state} note={post.saves.note}>{formatNumber(post.saves.value)}</MetricReadout></div>
                </div>
                <p className={cn('mt-4 text-xs', theme.textMuted)}>Engagements in this view = likes + comments + shares + saves where the save cell is observed. Total {formatNumber(engagementTotal(post))}.</p>
            </DashboardSection>

            <DashboardSection isDark={isDark} accent="violet" title="Growth since publish" description="Fixed-age mock curve, not a live poll.">
                <div className="h-[240px]">
                    <ResponsiveLine
                        data={growthData}
                        theme={getChartTheme(isDark)}
                        margin={{ top: 12, right: 16, bottom: 36, left: 48 }}
                        xScale={{ type: 'point' }}
                        yScale={{ type: 'linear', min: 0, max: 'auto' }}
                        colors={[CHART_COLORS.current]}
                        curve="monotoneX"
                        enableArea
                        areaOpacity={0.12}
                        pointSize={0}
                        useMesh
                        axisBottom={{ tickRotation: -35, tickSize: 0, tickPadding: 8 }}
                        axisLeft={{ tickSize: 0, tickPadding: 8, format: (value) => formatNumber(value) }}
                    />
                </div>
            </DashboardSection>

            {retentionData.length ? (
                <DashboardSection isDark={isDark} accent="blue" title="Video retention (mock)" description="Native retention curve with a labelled drop-off. Demo values only.">
                    <div className="h-[220px]">
                        <ResponsiveLine
                            data={retentionData}
                            theme={getChartTheme(isDark)}
                            margin={{ top: 12, right: 16, bottom: 36, left: 40 }}
                            xScale={{ type: 'point' }}
                            yScale={{ type: 'linear', min: 0, max: 100 }}
                            colors={[CHART_COLORS.secondary]}
                            curve="monotoneX"
                            pointSize={0}
                            useMesh
                            axisLeft={{ tickSize: 0, format: (value) => `${value}%` }}
                            axisBottom={{ tickSize: 0, tickRotation: -35 }}
                        />
                    </div>
                </DashboardSection>
            ) : null}

            <DashboardSection
                isDark={isDark}
                accent="green"
                title="Comment breakdown"
                description="Native comment count and the analysed sample are labelled separately. Percentage badges start at 20 classified comments."
            >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <DashboardStat isDark={isDark} label="Native comments" value={String(post.commentsCount)} />
                    <DashboardStat isDark={isDark} label="Eligible" value={String(post.eligibleComments)} />
                    <DashboardStat isDark={isDark} label="Classified" value={String(post.classifiedComments)} detail={`${formatPercent(coverage, 0)} coverage`} />
                    <DashboardStat isDark={isDark} label="Unclassified" value={String(post.unclassifiedComments)} />
                    <DashboardStat isDark={isDark} label="Positive share" value={post.classifiedComments >= 20 ? formatPercent((post.positiveComments / post.classifiedComments) * 100, 0) : `${post.positiveComments} positive`} />
                </div>
                <p className={cn('mt-4 text-sm font-light', theme.textSecondary)}>
                    {post.positiveComments} positive · {post.neutralComments} neutral · {post.negativeComments} negative · {post.mixedComments} mixed.
                    Sample is the mock extract, replies included, cutoff at last refresh.
                </p>
            </DashboardSection>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <DashboardSection isDark={isDark} accent="green" title="Top positive">
                    <CommentList isDark={isDark} comments={topPositive} emptyTitle="No positive comments in this extract" />
                </DashboardSection>
                <DashboardSection isDark={isDark} accent="brand" title="Top negative">
                    <CommentList isDark={isDark} comments={topNegative} emptyTitle="No negative comments in this extract" />
                </DashboardSection>
                <DashboardSection isDark={isDark} accent="amber" title="Top questions">
                    <CommentList isDark={isDark} comments={topQuestions} emptyTitle="No questions in this extract" />
                </DashboardSection>
            </div>

            <DashboardSection
                isDark={isDark}
                accent="slate"
                title="Comments"
                description={themeFilter ? `Filtered to theme: ${themeFilter}` : 'All mock comments on this post.'}
                actions={themeFilter ? (
                    <DashboardButton isDark={isDark} variant="subtle" onClick={() => onThemeFilter('')}>Clear theme</DashboardButton>
                ) : null}
            >
                <div className="mb-4 flex flex-wrap gap-2">
                    {['all', 'positive', 'negative', 'questions'].map((tab) => (
                        <DashboardButton key={tab} isDark={isDark} variant={commentTab === tab ? 'primary' : 'secondary'} onClick={() => setCommentTab(tab)}>
                            {tab}
                        </DashboardButton>
                    ))}
                    {[...new Set(post.comments.map((comment) => comment.theme))].map((item) => (
                        <DashboardButton key={item} isDark={isDark} variant={themeFilter === item ? 'primary' : 'subtle'} onClick={() => onThemeFilter(item)}>
                            {item}
                        </DashboardButton>
                    ))}
                </div>
                <CommentList isDark={isDark} comments={comments} />
            </DashboardSection>
        </div>
    );
};
