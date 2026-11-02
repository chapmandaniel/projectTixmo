import { loadWatchlist } from './watchlist.js';
import type { OfficialTarget } from './ingest.js';
import type { OrganizationTarget, Watchlist } from './types.js';

const readHints = (path: string): Watchlist | undefined => {
  try {
    return loadWatchlist(path);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'ENOENT') return undefined;
    throw error;
  }
};

export const watchlistFromTargets = (targets: OfficialTarget[], hints?: Watchlist): Watchlist => {
  const grouped = new Map<string, OfficialTarget[]>();
  for (const target of targets) {
    const rows = grouped.get(target.organizationId) ?? [];
    rows.push(target);
    grouped.set(target.organizationId, rows);
  }
  const organizations: OrganizationTarget[] = [...grouped.entries()].map(([organizationId, accounts]) => {
    const hint = hints?.organizations.find((org) => org.organizationId === organizationId);
    const names = hint?.names.length
      ? hint.names
      : [...new Set(accounts.map((account) => account.handle).filter((handle) => handle.length >= 4))];
    return {
      organizationId,
      ...(hint?.eventId ? { eventId: hint.eventId } : {}),
      names,
      domains: hint?.domains ?? [],
      accounts: accounts.map((account) => ({
        platform: account.platform,
        platformAccountId: account.platformAccountId,
        handle: account.handle,
      })),
    };
  });
  return { organizations };
};

export const watchlistForRun = async (options: {
  fixtures: boolean;
  watchlistPath: string;
  listTargets: () => Promise<OfficialTarget[]>;
}): Promise<{ watchlist: Watchlist; source: 'fixtures' | 'api' | 'file' }> => {
  if (options.fixtures) {
    return { watchlist: loadWatchlist(options.watchlistPath), source: 'fixtures' };
  }
  try {
    const targets = await options.listTargets();
    return {
      watchlist: watchlistFromTargets(targets, readHints(options.watchlistPath)),
      source: 'api',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'TargetsForbidden') {
      return { watchlist: loadWatchlist(options.watchlistPath), source: 'file' };
    }
    throw error;
  }
};
