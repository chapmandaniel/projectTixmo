import { likesCommentsShares, peopleReachedValue } from './plainCopy';

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

export const buildAttentionItems = (posts) => {
    const items = [];
    const rankedUnanswered = [...posts]
        .map((post) => ({ post, unanswered: unansweredOn(post) }))
        .filter((row) => row.unanswered.length)
        .sort((a, b) => b.unanswered.length - a.unanswered.length);
    if (rankedUnanswered[0]) {
        const { post, unanswered } = rankedUnanswered[0];
        items.push({
            id: 'unanswered',
            title: 'Unanswered questions',
            reason: `${unanswered.length} fan${unanswered.length === 1 ? '' : 's'} asked a question on ${post.thumbnailLabel} and ${unanswered.length === 1 ? 'is' : 'are'} still waiting.`,
            to: 'fans?tab=needs-reply',
        });
    }

    const merchComplaints = posts.flatMap((post) => post.comments
        .filter((comment) => (
            (comment.sentiment === 'negative' || comment.sentiment === 'mixed')
            && /merch|stock|sold out|restock|jacket|tee/i.test(`${comment.theme} ${comment.text}`)
        ))
        .map((comment) => ({ post, comment })));
    if (merchComplaints.length) {
        const post = merchComplaints[0].post;
        items.push({
            id: 'complaints',
            title: 'Complaints picking up',
            reason: `Merch sold-out comments jumped after ${post.thumbnailLabel}.`,
            to: 'fans?tab=complaints',
        });
    }

    const captionHit = posts.flatMap((post) => post.comments
        .filter((comment) => comment.sentiment === 'negative' && /caption|which night|wrong night/i.test(comment.text))
        .map((comment) => ({ post, comment })))[0];
    if (captionHit) {
        items.push({
            id: 'negative-post',
            title: 'A post is getting negative comments',
            reason: `${captionHit.post.thumbnailLabel} is being called out for the wrong night in the caption.`,
            to: `posts/${captionHit.post.id}`,
        });
    }

    return items;
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

export const buildHomeStory = (posts, rangeDays = 28) => {
    const topPosts = rankPostsByReach(posts).slice(0, 3);
    return {
        topPosts,
        whatHappened: buildWhatHappened(posts, rangeDays),
        attention: buildAttentionItems(posts),
        bestTimeToPost: bestTimeToPostSentence(topPosts[0]),
    };
};
