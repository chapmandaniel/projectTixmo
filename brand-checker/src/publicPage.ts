import type { HttpResponse, PlatformStop } from './types.js';

const LOGIN_URL = /\/(login|checkpoint|challenge|accounts\/login|signin)\b/i;
const CAPTCHA_URL = /captcha|recaptcha|hcaptcha/i;
const CAPTCHA_BODY = /g-recaptcha|hcaptcha|cf-challenge|verify you are human|confirm you(?:'|’)re human|captcha/i;
const LOGIN_BODY =
  /log in to continue|log in to facebook|log in to instagram|login_form|you must log in|sign up to see|please log in/i;
const BLOCK_BODY = /temporarily blocked|unusual activity|automated behavior|account suspended/i;

/** Decide whether a signed-out public page is a wall. The caller must stop that platform. */
export const detectPageStop = (response: HttpResponse): PlatformStop | null => {
  if (response.status === 429) return { state: 'BLOCKED', detail: 'http 429' };
  if (response.status === 401 || response.status === 403) return { state: 'BLOCKED', detail: `http ${response.status}` };
  let finalUrl = response.url;
  try {
    finalUrl = new URL(response.url).pathname + new URL(response.url).search;
  } catch {
    finalUrl = response.url;
  }
  const sample = response.body.slice(0, 100_000);
  if (CAPTCHA_URL.test(finalUrl) || CAPTCHA_BODY.test(sample)) return { state: 'CAPTCHA', detail: 'captcha' };
  if (LOGIN_URL.test(finalUrl) || LOGIN_BODY.test(sample)) return { state: 'LOGIN_PROMPT', detail: 'login wall' };
  if (BLOCK_BODY.test(sample)) return { state: 'BLOCKED', detail: 'blocked page' };
  return null;
};
