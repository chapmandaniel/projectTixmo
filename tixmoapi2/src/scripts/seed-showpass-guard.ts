/**
 * Runs before the seed loads config, Prisma, or Redis.
 * A production or non-sandbox Railway process exits here.
 */
const RAILWAY_SANDBOX_NAMES = new Set(['sandbox', 'development', 'dev', 'vendor-sandbox', 'labs']);

const refuse = (message: string): never => {
  console.error(message);
  process.exit(1);
};

if (process.env.SHOWPASS_SEED_ALLOW !== 'sandbox') {
  refuse('Showpass fixture seed requires SHOWPASS_SEED_ALLOW=sandbox');
}
if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
  refuse('Showpass fixture seed refuses to run when NODE_ENV or APP_ENV is production');
}

const railway = process.env.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase();
if (railway && !RAILWAY_SANDBOX_NAMES.has(railway)) {
  refuse(
    'Showpass fixture seed refuses this Railway environment. Allowed names: sandbox, development, dev, vendor-sandbox, labs'
  );
}

// This process is not the HTTP server. Config still parses CORS at import.
// An unset CORS_ORIGIN refuses vendor-sandbox, and an unset CLIENT_URL on labs
// would log a deploy warning. Pin one non-routable origin for the seed process
// only. It is not added to the API allowlist.
if (!process.env.CORS_ORIGIN?.trim()) process.env.CORS_ORIGIN = 'https://seed.invalid';
if (!process.env.CLIENT_URL?.trim()) process.env.CLIENT_URL = 'https://seed.invalid';

export {};
