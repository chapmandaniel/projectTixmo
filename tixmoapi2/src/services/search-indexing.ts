export const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';

/** True outside production. A named production Railway environment stays indexable. */
export const blocksSearchIndexing = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const railway = env.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase() || '';
  if (railway === 'production') return false;
  if (railway) return true;
  return env.NODE_ENV !== 'production';
};

/** Existing /health `environment` stays the Node environment. This is the Railway name. */
export const healthRailwayEnvironment = (env: NodeJS.ProcessEnv = process.env): string | null =>
  env.RAILWAY_ENVIRONMENT_NAME?.trim() || null;

export const healthBranch = (env: NodeJS.ProcessEnv = process.env): string | null => {
  // Railway sets RAILWAY_GIT_BRANCH=main on a pinned commit deploy. The labs branch wins.
  const labs = env.APP_LABS_BRANCH?.trim();
  if (labs) return labs;
  return env.RAILWAY_GIT_BRANCH?.trim() || null;
};
