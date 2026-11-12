import { likesCommentsShares, peopleReachedValue } from './plainCopy';
import { mentionSourcePlatform } from './platforms';

const REPORT_TIMEZONE = 'America/St_Johns';

export const rankPostsByReach = (posts) => (
    [...posts].sort((a, b) => (peopleReachedValue(b) || 0) - (peopleReachedValue(a) || 0))
);

export const rankPostsByEngagement = (posts) => (
    [...posts].sort((a, b) => likesCommentsShares(b) - likesCommentsShares(a))
);

const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const usualReach = (post, posts) => {
    const others = posts
        .filter((row) => row.id !== post.id)
        .map(peopleReachedValue)
        .filter((value) => value != null);
    return median(others);
};

const timesUsualLabel = (post, posts) => {
    const reached = peopleReachedValue(post);
    const usual = usualReach(post, posts);
    if (!reached || !usual) return null;
    const ratio = reached / usual;
    if (ratio < 1.2) return null;
    const label = ratio >= 10 ? `${Math.round(ratio)}x` : `${Math.round(ratio * 10) / 10}`.replace(/\.0$/, '') + 'x';
    return label;
};

const unansweredOn = (post) => post.comments.filter((comment) => comment.isQuestion && !comment.teamReplied);

const themePhrase = (theme) => String(theme || '')
    .replace(/^Questions about /i, '')
    .replace(/^Complaints about /i, '')
    .replace(/^Praise for /i, '')
    .trim()
    .toLowerCase();

const questionSnippet = (comment) => {
    const text = String(comment.text || '');
    if (/shuttle/i.test(text)) return 'whether the shuttle runs after 1am';
    if (/size/i.test(text)) return 'merch sizes';
    if (/door/i.test(text)) return 'doors';
    if (/ticket|GA |pass /i.test(text)) return 'tickets';
    const phrase = themePhrase(comment.theme);
    return phrase && phrase !== 'unclassified' ? phrase : null;
};

const SNAPSHOT_NOW = '2026-11-11T08:14:22-03:30';
const YESTERDAY = '2026-11-10';

const hoursAgo = (iso) => Math.max(1, Math.round((new Date(SNAPSHOT_NOW).getTime() - new Date(iso).getTime()) / (1000 * 60 * 60)));

const waitingLabel = (hours) => (hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`);

const trendSinceYesterday = (items, dateKey = 'createdAt') => {
    const n = items.filter((item) => String(item[dateKey] || '').slice(0, 10) === YESTERDAY).length;
    return n > 0 ? `+${n} since yesterday` : 'no new ones yesterday';
};

const uniquePlatforms = (posts) => [...new Set(posts.map((post) => post.platform).filter(Boolean))];

export const buildAttentionCards = (posts, mentions = []) => {
    const cards = [];

    const unansweredRows = posts.flatMap((post) => unansweredOn(post).map((comment) => ({ post, comment })));
    if (unansweredRows.length) {
        const oldest = [...unansweredRows].sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt))[0];
        const hours = hoursAgo(oldest.comment.createdAt);
        cards.push({
            id: 'unanswered',
            count: unansweredRows.length,
            label: 'Unanswered questions',
            severity: hours >= 12 || unansweredRows.length >= 3 ? 'urgent' : 'watch',
            platforms: uniquePlatforms(unansweredRows.map((row) => row.post)),
            context: `Oldest waiting ${waitingLabel(hours)}, on ${oldest.post.thumbnailLabel}`,
            trend: trendSinceYesterday(unansweredRows.map((row) => row.comment)),
            actionLabel: 'Reply',
            to: 'fans?tab=needs-reply',
        });
    }

    const complaintRows = posts.flatMap((post) => post.comments
        .filter((comment) => comment.sentiment === 'negative' || comment.sentiment === 'mixed')
        .map((comment) => ({ post, comment })));
    if (complaintRows.length) {
        const topPost = [...posts].sort((a, b) => (
            complaintRows.filter((row) => row.post.id === b.id).length - complaintRows.filter((row) => row.post.id === a.id).length
        ))[0];
        cards.push({
            id: 'complaints',
            count: complaintRows.length,
            label: 'Complaints picking up',
            severity: complaintRows.length >= 4 ? 'urgent' : 'watch',
            platforms: uniquePlatforms(complaintRows.map((row) => row.post)),
            context: `Mostly on ${topPost?.thumbnailLabel || 'recent posts'}`,
            trend: trendSinceYesterday(complaintRows.map((row) => row.comment)),
            actionLabel: 'Review',
            to: 'fans?tab=complaints',
        });
    }

    const negativePost = [...posts]
        .map((post) => {
            const samples = post.comments.filter((comment) => comment.sentiment === 'negative');
            return {
                post,
                samples,
                count: samples.length ? (post.negativeComments || samples.length) : 0,
            };
        })
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count)[0];
    if (negativePost) {
        const sample = negativePost.samples[0];
        cards.push({
            id: 'negative-post',
            count: negativePost.count,
            label: 'Negative comments on a post',
            severity: 'urgent',
            platforms: [negativePost.post.platform],
            context: sample && /caption|which night|wrong night/i.test(sample.text)
                ? `${negativePost.post.thumbnailLabel} is being called out for the wrong night in the caption.`
                : `On ${negativePost.post.thumbnailLabel}`,
            trend: trendSinceYesterday(negativePost.samples),
            actionLabel: 'Open post',
            to: `posts/${negativePost.post.id}`,
        });
    }

    if (mentions.length) {
        const byDay = new Map();
        mentions.forEach((mention) => {
            byDay.set(mention.date, (byDay.get(mention.date) || 0) + 1);
        });
        const days = [...byDay.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]));
        const [spikeDate, spikeCount] = days[0] || [];
        const otherCounts = days.slice(1).map((entry) => entry[1]);
        const usual = otherCounts.length ? otherCounts.reduce((sum, value) => sum + value, 0) / otherCounts.length : 0;
        if (spikeDate && spikeCount >= 3 && spikeCount >= Math.max(usual * 2, usual + 1)) {
            const spikeMentions = mentions.filter((mention) => mention.date === spikeDate);
            const logos = [...new Set(spikeMentions.map((mention) => mentionSourcePlatform(mention.source)).filter(Boolean))];
            cards.push({
                id: 'mention-spike',
                count: spikeCount,
                label: 'Unusual mention spike',
                severity: 'watch',
                platforms: logos,
                context: `${spikeCount} mentions on ${new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/St_Johns' }).format(new Date(`${spikeDate}T12:00:00-03:30`))}`,
                trend: `+${Math.round(spikeCount - usual)} vs a usual day`,
                actionLabel: 'Review',
                to: 'fans?tab=mentions',
            });
        }
    }

    const rank = { urgent: 0, watch: 1 };
    return cards.sort((a, b) => (rank[a.severity] - rank[b.severity]) || a.label.localeCompare(b.label));
};

export const buildWhatHappened = (posts, rangeDays = 28) => {
    const byReach = rankPostsByReach(posts);
    const byEngagement = rankPostsByEngagement(posts);
    const bestReach = byReach[0];
    const bestEngagement = byEngagement[0];
    const lines = [];

    if (bestReach && peopleReachedValue(bestReach) != null) {
        const times = timesUsualLabel(bestReach, posts);
        lines.push({
            id: 'best-reach',
            postId: bestReach.id,
            text: times
                ? `Your ${bestReach.thumbnailLabel} was your best post in the last ${rangeDays} days — ${times} your usual reach.`
                : `Your ${bestReach.thumbnailLabel} was your best post in the last ${rangeDays} days.`,
            to: `posts/${bestReach.id}`,
        });
    }

    if (bestEngagement && likesCommentsShares(bestEngagement) > 0) {
        lines.push({
            id: 'best-engagement',
            postId: bestEngagement.id,
            text: `The ${bestEngagement.thumbnailLabel} brought in more likes, comments and shares than any other post.`,
            to: `posts/${bestEngagement.id}`,
        });
    }

    const questions = posts.flatMap((post) => post.comments.filter((comment) => comment.isQuestion));
    const snippets = [];
    questions.forEach((comment) => {
        const snippet = questionSnippet(comment);
        if (snippet && !snippets.includes(snippet)) snippets.push(snippet);
    });
    const preferred = ['merch sizes', 'whether the shuttle runs after 1am', 'tickets', 'doors'];
    snippets.sort((a, b) => {
        const ai = preferred.indexOf(a);
        const bi = preferred.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    if (snippets.length) {
        const [first, second] = snippets;
        const text = second
            ? `Fans keep asking about ${first} and ${second}.`
            : `Fans keep asking about ${first}.`;
        lines.push({
            id: 'questions',
            text,
            to: 'fans?tab=questions',
        });
    }

    return lines.slice(0, 3);
};

export const bestTimeToPostSentence = (post) => {
    if (!post) return 'Not enough posts yet to suggest a time.';
    const date = new Date(post.publishedAt);
    const weekday = new Intl.DateTimeFormat('en-CA', { weekday: 'long', timeZone: REPORT_TIMEZONE }).format(date);
    const hour = Number(new Intl.DateTimeFormat('en-CA', {
        hour: 'numeric',
        hourCycle: 'h23',
        timeZone: REPORT_TIMEZONE,
    }).format(date));
    const startHour = Math.max(0, hour - 1);
    const endHour = Math.min(23, hour + 1);
    const parts = (value) => {
        const suffix = value >= 12 ? 'PM' : 'AM';
        const twelve = value % 12 === 0 ? 12 : value % 12;
        return { twelve, suffix };
    };
    const start = parts(startHour);
    const end = parts(endHour);
    const window = start.suffix === end.suffix
        ? `${start.twelve}–${end.twelve} ${end.suffix}`
        : `${start.twelve} ${start.suffix}–${end.twelve} ${end.suffix}`;
    return `Your posts do best ${weekday}s ${window}`;
};

export const buildHomeStory = (posts, rangeDays = 28, mentions = []) => {
    const topPosts = rankPostsByReach(posts).slice(0, 3);
    return {
        topPosts,
        whatHappened: buildWhatHappened(posts, rangeDays),
        attention: buildAttentionCards(posts, mentions),
        bestTimeToPost: bestTimeToPostSentence(topPosts[0]),
    };
};
