const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export const exportPostsCsv = (posts) => {
    const header = ['id', 'accountId', 'platform', 'publishedAt', 'caption', 'peopleReached', 'likes', 'comments', 'shares', 'linkClicks'];
    const lines = [
        header.join(','),
        ...posts.map((post) => [
            post.id,
            post.accountId,
            post.platform,
            post.publishedAt,
            post.caption,
            post.reach.value,
            post.likes,
            post.commentsCount,
            post.shares,
            post.clicks.value,
        ].map(csvEscape).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'northlight-live-demo-posts.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};
