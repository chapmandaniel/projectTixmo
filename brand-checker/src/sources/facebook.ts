import { Pace } from '../pace.js';
import { collectPublicProfiles } from './publicProfiles.js';
import type { HttpClient, OrganizationTarget, SourceResult } from '../types.js';

export const collectFacebook = (
  orgs: OrganizationTarget[],
  http: HttpClient,
  pace: Pace,
  userAgent: string,
  now = new Date()
): Promise<SourceResult> => collectPublicProfiles('FACEBOOK', orgs, http, pace, userAgent, now);
