import { writeReport, type CheckerConfig } from './config.js';
import { FatalApiError, TixmoClient } from './ingest.js';
import { createFileCache } from './net.js';
import { Pace } from './pace.js';
import { collectFacebook } from './sources/facebook.js';
import { collectInstagram } from './sources/instagram.js';
import { collectLookalikes } from './sources/lookalike.js';
import { collectReddit } from './sources/reddit.js';
import { collectX } from './sources/x.js';
import { isRejectedSource } from './text.js';
import type { Finding, HttpClient, Logger, PlatformName, SourceResult, Verification } from './types.js';
import { watchlistForRun } from './targets.js';

export type PlatformSummary = {
  platform: PlatformName | 'X' | 'REDDIT' | 'FACEBOOK' | 'INSTAGRAM' | 'LOOKALIKE_DOMAIN';
  state: string;
  findings: number;
  skipped?: boolean;
};

export type RunSummary = {
  ok: boolean;
  status?: number;
  matches: number;
  verifications: number;
  platforms: PlatformSummary[];
};

export type RunDeps = {
  config: CheckerConfig;
  sourceHttp: HttpClient;
  apiHttp: HttpClient;
  logger: Logger;
  sleep?: (ms: number) => Promise<void>;
  now?: Date;
};

const dedupeFindings = (findings: Finding[]): Finding[] => {
  const seen = new Set<string>();
  const unique: Finding[] = [];
  for (const finding of findings) {
    if (isRejectedSource(finding.sourceUrl)) continue;
    const key = `${finding.organizationId}:${finding.sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }
  return unique;
};

const dedupeCodes = (verifications: Verification[]): Verification[] => {
  const seen = new Set<string>();
  return verifications.filter((item) => {
    const key = `${item.platform}:${item.platformAccountId}:${item.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const runChecker = async (deps: RunDeps): Promise<RunSummary> => {
  const { config, logger } = deps;
  const now = deps.now ?? new Date();
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const userAgent = `TixmoBrandChecker/1.0 (+${config.contactUrl})`;
  let fatalStatus: number | undefined;
  const client = new TixmoClient({
    apiUrl: config.apiUrl,
    token: config.checkerToken,
    http: deps.apiHttp,
    logger,
    onFatal: (status) => {
      fatalStatus = status;
      writeReport(config.reportPath, { ok: false, status, at: now.toISOString() }, logger);
    },
  });
  const platforms: PlatformSummary[] = [];
  const collected: Finding[] = [];
  const codes: Verification[] = [];

  const finish = async (platform: PlatformSummary['platform'], result: SourceResult) => {
    if (result.skipped) {
      platforms.push({ platform, state: 'SKIPPED', findings: 0, skipped: true });
      logger.info(`brand-checker: ${platform} skipped`);
      return;
    }
    collected.push(...result.findings);
    codes.push(...result.verifications);
    if (result.stop) {
      await client.reportStatus(platform, result.stop.state, result.stop.detail);
      platforms.push({ platform, state: result.stop.state, findings: result.findings.length });
      logger.info(`brand-checker: ${platform} stopped (${result.stop.state})`);
      return;
    }
    await client.reportStatus(platform, 'OK', `matches ${result.findings.length}`);
    platforms.push({ platform, state: 'OK', findings: result.findings.length });
    logger.info(`brand-checker: ${platform} ok, findings ${result.findings.length}`);
  };

  try {
    const resolved = await watchlistForRun({
      fixtures: config.fixtures,
      watchlistPath: config.watchlistPath,
      listTargets: () => client.listTargets(),
    });
    const watchlist = resolved.watchlist;
    logger.info(`brand-checker: targets from ${resolved.source}`);
    const xToken = config.fixtures ? config.xBearerToken || 'fixture-bearer' : config.xBearerToken;
    const redditId = config.fixtures ? config.redditClientId || 'fixture-id' : config.redditClientId;
    const redditSecret = config.fixtures
      ? config.redditClientSecret || 'fixture-secret'
      : config.redditClientSecret;
    await finish('X', await collectX(watchlist.organizations, deps.sourceHttp, xToken, now));
    await finish(
      'REDDIT',
      await collectReddit(watchlist.organizations, deps.sourceHttp, redditId, redditSecret, now)
    );
    const pace = new Pace(config.publicPageIntervalMs, sleep);
    await finish(
      'FACEBOOK',
      await collectFacebook(watchlist.organizations, deps.sourceHttp, pace, userAgent, now)
    );
    await finish(
      'INSTAGRAM',
      await collectInstagram(watchlist.organizations, deps.sourceHttp, pace, userAgent, now)
    );
    await finish(
      'LOOKALIKE_DOMAIN',
      await collectLookalikes(
        watchlist.organizations,
        deps.sourceHttp,
        createFileCache(config.crtshCachePath, () => now.getTime()),
        userAgent,
        sleep,
        config.lookalikeSearchApiUrl,
        config.lookalikeSearchApiKey,
        now
      )
    );
    const verifications = dedupeCodes(codes);
    for (const verification of verifications) {
      await client.submitVerification(verification);
    }
    const matches = dedupeFindings(collected);
    const submitted = matches.length ? await client.submitMatches(matches) : 0;
    const summary: RunSummary = {
      ok: true,
      matches: submitted,
      verifications: verifications.length,
      platforms,
    };
    writeReport(
      config.reportPath,
      { ok: true, matches: submitted, verifications: verifications.length, at: now.toISOString() },
      logger
    );
    return summary;
  } catch (error) {
    if (error instanceof FatalApiError) {
      return {
        ok: false,
        status: fatalStatus ?? error.status,
        matches: 0,
        verifications: 0,
        platforms,
      };
    }
    logger.alert('ALERT brand-checker: run failed; recording a failed run and stopping');
    writeReport(config.reportPath, { ok: false, at: now.toISOString() }, logger);
    return { ok: false, matches: 0, verifications: 0, platforms };
  }
};
