export type SocialPlatform = 'X' | 'REDDIT' | 'FACEBOOK' | 'INSTAGRAM';
export type PlatformName = SocialPlatform | 'LOOKALIKE_DOMAIN';
export type CategoryName =
  | 'IMPERSONATION_PROFILE'
  | 'FAKE_CONTEST'
  | 'FALSE_ASSOCIATION'
  | 'LOOKALIKE_DOMAIN';
export type CheckerState = 'OK' | 'BLOCKED' | 'LOGIN_PROMPT' | 'CAPTCHA';

export type OrgAccount = {
  platform: SocialPlatform;
  platformAccountId: string;
  handle: string;
  profileUrl?: string;
  displayName?: string;
};

export type OrganizationTarget = {
  organizationId: string;
  eventId?: string;
  names: string[];
  domains: string[];
  accounts: OrgAccount[];
};

export type Watchlist = {
  organizations: OrganizationTarget[];
};

export type Finding = {
  organizationId: string;
  eventId?: string;
  platform: PlatformName;
  category: CategoryName;
  sourceUrl: string;
  platformAccountId?: string;
  accountHandle?: string;
  suspectDisplayName?: string;
  matchedText?: string;
  matchedRule: string;
  detectedAt: string;
  imitatedPlatformAccountId?: string;
  evidencePhones?: string[];
  evidenceEmails?: string[];
};

export type Verification = {
  platform: SocialPlatform;
  platformAccountId: string;
  code: string;
  verificationMethod: 'ONE_TIME_CODE';
};

export type PlatformStop = {
  state: Exclude<CheckerState, 'OK'>;
  detail: string;
};

export type SourceResult = {
  findings: Finding[];
  verifications: Verification[];
  stop?: PlatformStop;
  skipped?: boolean;
};

export type HttpResponse = {
  status: number;
  url: string;
  body: string;
};

export type HttpRequest = {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
};

export interface HttpClient {
  request(url: string, init?: HttpRequest): Promise<HttpResponse>;
}

export type Logger = {
  info(message: string): void;
  alert(message: string): void;
  warn?(message: string): void;
};
