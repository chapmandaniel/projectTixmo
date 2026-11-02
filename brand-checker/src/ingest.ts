import type { CheckerState, Finding, HttpClient, Logger, PlatformName, Verification } from './types.js';
import { isRejectedSource } from './text.js';

export class FatalApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Tixmo API returned ${status}`);
    this.name = 'FatalApiError';
    this.status = status;
  }
}

export class TargetsForbidden extends Error {
  constructor() {
    super('Checker token cannot read targets');
    this.name = 'TargetsForbidden';
  }
}

export type OfficialTarget = {
  organizationId: string;
  platform: 'X' | 'REDDIT' | 'FACEBOOK' | 'INSTAGRAM';
  platformAccountId: string;
  handle: string;
};

const payload = (finding: Finding): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    organizationId: finding.organizationId,
    platform: finding.platform,
    category: finding.category,
    sourceUrl: finding.sourceUrl,
    matchedRule: finding.matchedRule,
    detectedAt: finding.detectedAt,
  };
  if (finding.eventId) body.eventId = finding.eventId;
  if (finding.platform === 'LOOKALIKE_DOMAIN') return body;
  if (finding.platformAccountId) body.platformAccountId = finding.platformAccountId;
  if (finding.accountHandle) body.accountHandle = finding.accountHandle;
  if (finding.suspectDisplayName) body.suspectDisplayName = finding.suspectDisplayName;
  if (finding.matchedText) body.matchedText = finding.matchedText;
  if (finding.imitatedPlatformAccountId) body.imitatedPlatformAccountId = finding.imitatedPlatformAccountId;
  if (finding.evidencePhones?.length) body.evidencePhones = finding.evidencePhones;
  if (finding.evidenceEmails?.length) body.evidenceEmails = finding.evidenceEmails;
  return body;
};

export class TixmoClient {
  constructor(
    private readonly options: {
      apiUrl: string;
      token: string;
      http: HttpClient;
      logger: Logger;
      onFatal: (status: number) => void;
    }
  ) {}

  private async request(path: string, method: 'GET' | 'POST', body?: unknown): Promise<{ status: number; body: string }> {
    let response;
    try {
      response = await this.options.http.request(`${this.options.apiUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      this.options.logger.alert(
        'ALERT brand-checker: Tixmo API request failed; recording a failed run and stopping'
      );
      this.options.onFatal(0);
      throw new FatalApiError(0);
    }
    return response;
  }

  private async post(path: string, body: unknown): Promise<void> {
    const response = await this.request(path, 'POST', body);
    if (response.status >= 400) {
      this.options.logger.alert(
        `ALERT brand-checker: Tixmo API returned ${response.status}; recording a failed run and stopping`
      );
      this.options.onFatal(response.status);
      throw new FatalApiError(response.status);
    }
  }

  async listTargets(): Promise<OfficialTarget[]> {
    const targets: OfficialTarget[] = [];
    const limit = 100;
    for (let page = 1; page <= 20; page += 1) {
      const response = await this.request(
        `/api/v1/brand-protection/ingest/targets?page=${page}&limit=${limit}`,
        'GET'
      );
      if (response.status === 403) throw new TargetsForbidden();
      if (response.status >= 400) {
        this.options.logger.alert(
          `ALERT brand-checker: Tixmo API returned ${response.status}; recording a failed run and stopping`
        );
        this.options.onFatal(response.status);
        throw new FatalApiError(response.status);
      }
      const parsed = JSON.parse(response.body) as {
        data?: { targets?: unknown };
        meta?: { total?: unknown };
      };
      const rows = Array.isArray(parsed.data?.targets) ? parsed.data.targets : [];
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const target = row as Record<string, unknown>;
        const platform = target.platform;
        if (platform !== 'X' && platform !== 'REDDIT' && platform !== 'FACEBOOK' && platform !== 'INSTAGRAM') {
          continue;
        }
        if (
          typeof target.organizationId !== 'string' ||
          typeof target.platformAccountId !== 'string' ||
          typeof target.handle !== 'string'
        ) {
          continue;
        }
        targets.push({
          organizationId: target.organizationId,
          platform,
          platformAccountId: target.platformAccountId,
          handle: target.handle,
        });
      }
      const total = typeof parsed.meta?.total === 'number' ? parsed.meta.total : targets.length;
      if (rows.length < limit || targets.length >= total) break;
    }
    return targets;
  }

  async reportStatus(platform: PlatformName, state: CheckerState, detail?: string): Promise<void> {
    await this.post('/api/v1/brand-protection/ingest/status', {
      platform,
      state,
      ...(detail ? { detail: detail.slice(0, 200) } : {}),
    });
  }

  async submitVerification(verification: Verification): Promise<void> {
    await this.post('/api/v1/brand-protection/ingest/verifications', verification);
  }

  async submitMatches(findings: Finding[]): Promise<number> {
    const accepted = findings.filter((finding) => !isRejectedSource(finding.sourceUrl));
    for (let index = 0; index < accepted.length; index += 50) {
      const matches = accepted.slice(index, index + 50).map(payload);
      if (!matches.length) continue;
      await this.post('/api/v1/brand-protection/ingest/matches', { matches });
    }
    return accepted.length;
  }
}
