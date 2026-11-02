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

  private async post(path: string, body: unknown): Promise<void> {
    let response;
    try {
      response = await this.options.http.request(`${this.options.apiUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      this.options.logger.alert(
        'ALERT brand-checker: Tixmo API request failed; recording a failed run and stopping'
      );
      this.options.onFatal(0);
      throw new FatalApiError(0);
    }
    if (response.status >= 400) {
      this.options.logger.alert(
        `ALERT brand-checker: Tixmo API returned ${response.status}; recording a failed run and stopping`
      );
      this.options.onFatal(response.status);
      throw new FatalApiError(response.status);
    }
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
