export const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';

/** Production stays indexable. A labs branch or any other VITE_APP_ENV blocks indexing. */
export const dashShouldNoIndex = ({ appEnv = '', labsBranch = '' } = {}) => {
    if (String(labsBranch || '').trim()) return true;
    const env = String(appEnv || '').trim().toLowerCase();
    return Boolean(env) && env !== 'production';
};
