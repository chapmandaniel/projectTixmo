export const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';
export const NOINDEX_META = '<meta name="robots" content="noindex,nofollow" />';

export const injectNoIndexMeta = (html) => {
    if (html.includes('name="robots"')) return html;
    return html.replace(/<head>/i, `<head>\n    ${NOINDEX_META}`);
};

/** Production stays indexable. A labs branch or any other VITE_APP_ENV blocks indexing. */
export const dashShouldNoIndex = ({ appEnv = '', labsBranch = '' } = {}) => {
    if (String(labsBranch || '').trim()) return true;
    const env = String(appEnv || '').trim().toLowerCase();
    return Boolean(env) && env !== 'production';
};
