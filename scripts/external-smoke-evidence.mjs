#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const timeoutMs = Number(process.env.TIXMO_SMOKE_TIMEOUT_MS || 12000);

const usage = `Usage:
  TIXMO_API_BASE_URL=https://api.example.com npm run smoke:external
  TIXMO_API_BASE_URL=https://api.example.com TIXMO_DASHBOARD_URL=https://app.example.com npm run smoke:external

Optional environment:
  TIXMO_SMOKE_EMAIL             Operator email. Default: demo.admin@tixmo.test
  TIXMO_SMOKE_PASSWORD          Operator password. Default: DemoPass123!
  TIXMO_SMOKE_REVIEW_TOKEN      Public approval review token. Default: market-demo-approval-token
  TIXMO_SMOKE_SHARE_TOKEN       Public asset share token. Default: market-demo-share-token
  TIXMO_SMOKE_SCANNER_KEY       Scanner API key. Default: sk_scanner_market_demo_main_gate
  TIXMO_SMOKE_CHECKOUT_SLUG     Public checkout event slug. Default: market-demo-harborlight-summer-session
  TIXMO_SMOKE_EVIDENCE_PATH     Write JSON evidence to this path.
  TIXMO_SMOKE_TIMEOUT_MS        Request timeout in milliseconds. Default: 12000.
`;

const config = {
  apiBaseUrl: process.env.TIXMO_API_BASE_URL || process.env.API_BASE_URL || '',
  dashboardUrl: process.env.TIXMO_DASHBOARD_URL || process.env.DASHBOARD_URL || '',
  email: process.env.TIXMO_SMOKE_EMAIL || 'demo.admin@tixmo.test',
  password: process.env.TIXMO_SMOKE_PASSWORD || 'DemoPass123!',
  reviewToken: process.env.TIXMO_SMOKE_REVIEW_TOKEN || 'market-demo-approval-token',
  shareToken: process.env.TIXMO_SMOKE_SHARE_TOKEN || 'market-demo-share-token',
  scannerKey: process.env.TIXMO_SMOKE_SCANNER_KEY || 'sk_scanner_market_demo_main_gate',
  checkoutSlug:
    process.env.TIXMO_SMOKE_CHECKOUT_SLUG || 'market-demo-harborlight-summer-session',
  evidencePath: process.env.TIXMO_SMOKE_EVIDENCE_PATH || '',
};

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(usage);
  process.exit(0);
}

if (!config.apiBaseUrl) {
  process.stderr.write('[smoke:external] TIXMO_API_BASE_URL is required.\n\n');
  process.stderr.write(usage);
  process.exit(1);
}

const normalizeBaseUrl = (value, label) => {
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${label} is not a valid URL: ${value}`);
  }
};

const apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl, 'TIXMO_API_BASE_URL');
const dashboardBaseUrl = config.dashboardUrl
  ? normalizeBaseUrl(config.dashboardUrl, 'TIXMO_DASHBOARD_URL')
  : '';

const evidence = {
  startedAt: new Date().toISOString(),
  apiBaseUrl,
  dashboardUrl: dashboardBaseUrl || null,
  operatorEmail: config.email,
  steps: [],
  ids: {},
  result: 'running',
};

const redact = (value) => {
  if (!value) return value;
  const text = String(value);
  if (text.length <= 8) return '<redacted>';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
};

const recordStep = (name, status, details = {}) => {
  const step = {
    name,
    status,
    at: new Date().toISOString(),
    ...details,
  };
  evidence.steps.push(step);
  const suffix = details.summary ? ` ${details.summary}` : '';
  process.stdout.write(`[smoke:external] ${status} ${name}${suffix}\n`);
};

const request = async (name, url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'tixmo-external-smoke/1.0',
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    const durationMs = Date.now() - startedAt;
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    let body = text;

    if (contentType.includes('application/json')) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`${name} returned malformed JSON`);
      }
    }

    if (response.status < 200 || response.status >= 400) {
      const preview = typeof body === 'string'
        ? body.slice(0, 180).replace(/\s+/g, ' ').trim()
        : JSON.stringify(body).slice(0, 180);
      throw new Error(`${name} returned HTTP ${response.status}: ${preview}`);
    }

    recordStep(name, 'pass', {
      httpStatus: response.status,
      durationMs,
      summary: `${response.status} ${durationMs}ms`,
    });

    return { response, body, durationMs };
  } finally {
    clearTimeout(timeout);
  }
};

const unwrapData = (body) => body?.data ?? body;

const apiUrl = (pathname) => new URL(pathname, `${apiBaseUrl}/`).toString();
const dashboardUrl = (pathname) => dashboardBaseUrl
  ? new URL(pathname, `${dashboardBaseUrl}/`).toString()
  : '';
const htmlRequestOptions = {
  headers: {
    accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  },
};

const writeEvidence = () => {
  evidence.finishedAt = new Date().toISOString();

  if (!config.evidencePath) {
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    return;
  }

  const outputPath = path.resolve(config.evidencePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`[smoke:external] evidence written ${outputPath}\n`);
};

const chooseEventForAttendance = (events) =>
  events.find((event) => event.status === 'COMPLETED') ||
  events.find((event) => event.status === 'ON_SALE') ||
  events.find((event) => event.status === 'PUBLISHED') ||
  events[0];

try {
  await request('api root health', apiUrl('/health'));
  await request('api version health', apiUrl('/api/v1/health'));

  const login = await request('operator login', apiUrl('/api/v1/auth/login'), {
    method: 'POST',
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
  });
  const loginData = unwrapData(login.body);
  const accessToken = loginData?.accessToken;
  const user = loginData?.user;

  if (!accessToken || !user?.organizationId) {
    throw new Error('operator login did not return accessToken and organizationId');
  }

  evidence.ids.userId = user.id;
  evidence.ids.organizationId = user.organizationId;

  const authHeaders = { authorization: `Bearer ${accessToken}` };

  const me = await request('current user', apiUrl('/api/v1/auth/me'), { headers: authHeaders });
  const currentUser = unwrapData(me.body);
  evidence.ids.currentUserRole = currentUser?.role;

  const organization = await request(
    'organization lookup',
    apiUrl(`/api/v1/organizations/${user.organizationId}`),
    { headers: authHeaders }
  );
  const organizationData = unwrapData(organization.body);
  evidence.ids.organizationName = organizationData?.name;
  evidence.ids.organizationSlug = organizationData?.slug;

  const eventsResponse = await request(
    'events list',
    apiUrl('/api/v1/events?limit=100'),
    { headers: authHeaders }
  );
  const eventsPayload = unwrapData(eventsResponse.body);
  const events = eventsPayload?.events || (Array.isArray(eventsPayload) ? eventsPayload : []);
  if (!events.length) {
    throw new Error('events list did not return any events');
  }

  evidence.ids.eventCount = events.length;
  evidence.ids.eventNames = events.slice(0, 6).map((event) => event.name || event.title || event.id);

  const checkout = await request(
    'public checkout event',
    apiUrl(`/api/v1/events/public/${encodeURIComponent(config.checkoutSlug)}`)
  );
  const checkoutEvent = unwrapData(checkout.body);
  const checkoutTicketTypes = Array.isArray(checkoutEvent?.ticketTypes)
    ? checkoutEvent.ticketTypes
    : [];
  const availableCheckoutTicketTypes = checkoutTicketTypes.filter(
    (ticketType) => ticketType.status === 'ACTIVE' && Number(ticketType.quantityAvailable || 0) > 0
  );

  if (!checkoutEvent?.id || !checkoutTicketTypes.length || !availableCheckoutTicketTypes.length) {
    throw new Error('public checkout event did not return available ticket types');
  }

  evidence.ids.checkoutEventId = checkoutEvent.id;
  evidence.ids.checkoutEventSlug = checkoutEvent.slug || config.checkoutSlug;
  evidence.ids.checkoutEventName = checkoutEvent.name || checkoutEvent.title;
  evidence.ids.checkoutTicketTypeCount = checkoutTicketTypes.length;
  evidence.ids.checkoutAvailableTicketTypeIds = availableCheckoutTicketTypes
    .slice(0, 6)
    .map((ticketType) => ticketType.id);

  const attendanceEvent = chooseEventForAttendance(events);
  evidence.ids.attendanceEventId = attendanceEvent?.id;
  evidence.ids.attendanceEventName = attendanceEvent?.name || attendanceEvent?.title;
  evidence.ids.attendanceEventStatus = attendanceEvent?.status;

  await request(
    'dashboard report',
    apiUrl(`/api/v1/reports/dashboard?organizationId=${encodeURIComponent(user.organizationId)}`),
    { headers: authHeaders }
  );
  await request(
    'sales report',
    apiUrl(`/api/v1/reports/sales?organizationId=${encodeURIComponent(user.organizationId)}&groupBy=event`),
    { headers: authHeaders }
  );

  if (attendanceEvent?.id) {
    await request(
      'attendance report',
      apiUrl(`/api/v1/reports/attendance?eventId=${encodeURIComponent(attendanceEvent.id)}`),
      { headers: authHeaders }
    );
  }

  const scannerAuth = await request('scanner auth', apiUrl('/api/v1/scanners/auth'), {
    method: 'POST',
    body: JSON.stringify({ apiKey: config.scannerKey }),
  });
  const scanner = unwrapData(scannerAuth.body);
  evidence.ids.scannerId = scanner?.id;
  evidence.ids.scannerName = scanner?.name;
  evidence.ids.scannerKeyReference = redact(config.scannerKey);

  const scannerEventId = scanner?.eventId || scanner?.event?.id || attendanceEvent?.id;
  if (!scannerEventId) {
    throw new Error('scanner auth did not identify an event and no fallback event exists');
  }
  evidence.ids.scannerEventId = scannerEventId;

  await request(
    'scanner sync',
    apiUrl(`/api/v1/scanners/sync?eventId=${encodeURIComponent(scannerEventId)}`),
    { headers: { authorization: `Bearer ${config.scannerKey}` } }
  );

  const review = await request(
    'public review token',
    apiUrl(`/api/v1/review/${encodeURIComponent(config.reviewToken)}`)
  );
  const reviewData = unwrapData(review.body);
  evidence.ids.reviewTokenReference = redact(config.reviewToken);
  evidence.ids.approvalId = reviewData?.approval?.id || reviewData?.id;
  evidence.ids.approvalTitle = reviewData?.approval?.title || reviewData?.title;

  const share = await request(
    'public asset share token',
    apiUrl(`/api/v1/assets/shares/${encodeURIComponent(config.shareToken)}`)
  );
  const shareData = unwrapData(share.body);
  evidence.ids.shareTokenReference = redact(config.shareToken);
  evidence.ids.shareFolderId = shareData?.folder?.id || shareData?.share?.folderId;
  evidence.ids.shareAssetCount = Array.isArray(shareData?.assets) ? shareData.assets.length : undefined;

  if (dashboardBaseUrl) {
    await request('dashboard root', dashboardUrl('/'), htmlRequestOptions);
    await request(
      'dashboard checkout route',
      dashboardUrl(`/checkout/${encodeURIComponent(config.checkoutSlug)}`),
      htmlRequestOptions
    );
    await request(
      'dashboard review route',
      dashboardUrl(`/review/${encodeURIComponent(config.reviewToken)}`),
      htmlRequestOptions
    );
    await request(
      'dashboard shared asset route',
      dashboardUrl(`/assets/shared/${encodeURIComponent(config.shareToken)}`),
      htmlRequestOptions
    );
  }

  evidence.result = 'pass';
  writeEvidence();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  evidence.result = 'fail';
  recordStep('external smoke', 'fail', { summary: message });
  writeEvidence();
  process.exit(1);
}
