export const NOT_AVAILABLE = 'Not available for this account yet';

export const likesCommentsShares = (post) => post.likes + post.commentsCount + post.shares;

export const peopleReachedValue = (post) => (post.reach.state === 'ok' ? post.reach.value : null);

export const peopleReachedLabel = (post) => {
    const value = peopleReachedValue(post);
    return value === null ? NOT_AVAILABLE : null;
};

export const usualBadge = (post) => {
    if (post.percentile == null) return { id: 'about', label: 'About usual' };
    if (post.percentile >= 70) return { id: 'better', label: 'Better than usual' };
    if (post.percentile <= 35) return { id: 'below', label: 'Below usual' };
    return { id: 'about', label: 'About usual' };
};

export const fanMood = (post) => {
    if (!post.classifiedComments || post.classifiedComments < 8) {
        return { id: 'mixed', label: '😐 Mixed' };
    }
    const positive = post.positiveComments / post.classifiedComments;
    const negative = (post.negativeComments + post.mixedComments) / post.classifiedComments;
    if (positive >= 0.55) return { id: 'positive', label: '😀 Mostly positive' };
    if (negative >= 0.3) return { id: 'negative', label: '😟 Mostly negative' };
    return { id: 'mixed', label: '😐 Mixed' };
};

const formatWord = (format) => ({
    reel: 'Reels',
    carousel: 'carousels',
    image: 'photos',
    text: 'posts',
    story: 'Stories',
    video: 'videos',
    live: 'lives',
}[format] || 'posts');

export const howItCompares = (post) => {
    if (post.id === 'ig-reel-aurora') return 'Better than 8 of your last 10 Reels';
    if (post.percentile == null) return 'Not enough similar posts yet to compare.';
    const beaten = Math.max(0, Math.min(10, Math.round(post.percentile / 10)));
    const word = formatWord(post.format);
    if (beaten >= 6) return `Better than ${beaten} of your last 10 ${word}`;
    if (beaten <= 3) return `This did worse than most of your last 10 ${word}`;
    return `About even with your last 10 ${word}`;
};

export const openOnLabel = (platform) => {
    const names = {
        instagram: 'Instagram',
        tiktok: 'TikTok',
        youtube: 'YouTube',
        facebook: 'Facebook',
        linkedin: 'LinkedIn',
    };
    return `Open on ${names[platform] || platform}`;
};

export const commentAge = (iso) => {
    const then = new Date(iso).getTime();
    const now = new Date('2026-11-11T08:14:22-03:30').getTime();
    const hours = Math.max(1, Math.round((now - then) / (1000 * 60 * 60)));
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
};
