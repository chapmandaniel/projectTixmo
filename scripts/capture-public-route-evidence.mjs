#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const usage = `Usage:
  npm run evidence:public-routes
  TIXMO_DASHBOARD_URL=https://app.example.com npm run evidence:public-routes

Optional environment:
  TIXMO_DASHBOARD_URL                 Dashboard origin. Default: http://127.0.0.1:5173
  TIXMO_PUBLIC_EVIDENCE_PATH          Output directory. Default: docs/public-route-screenshots
  TIXMO_SMOKE_CHECKOUT_SLUG           Checkout event slug. Default: market-demo-harborlight-summer-session
  TIXMO_SMOKE_REVIEW_TOKEN            Review token. Default: market-demo-approval-token
  TIXMO_SMOKE_SHARE_TOKEN             Asset share token. Default: market-demo-share-token
  TIXMO_PUBLIC_CHECKOUT_TEXT          Text expected on checkout route. Default: Harborlight Summer Session
  TIXMO_PUBLIC_REVIEW_TEXT            Text expected on review route. Default: Harborlight campaign artwork
  TIXMO_PUBLIC_SHARE_TEXT             Text expected on shared asset route. Default: Secure folder share
  TIXMO_CHROME_PATH                   Chrome executable path.
  TIXMO_PUBLIC_EVIDENCE_REQUIRE_POLICIES  Set true to require visible checkout policy links.
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(usage);
  process.exit(0);
}

const config = {
  dashboardUrl: process.env.TIXMO_DASHBOARD_URL || 'http://127.0.0.1:5173',
  outputDir: process.env.TIXMO_PUBLIC_EVIDENCE_PATH || 'docs/public-route-screenshots',
  checkoutSlug:
    process.env.TIXMO_SMOKE_CHECKOUT_SLUG || 'market-demo-harborlight-summer-session',
  reviewToken: process.env.TIXMO_SMOKE_REVIEW_TOKEN || 'market-demo-approval-token',
  shareToken: process.env.TIXMO_SMOKE_SHARE_TOKEN || 'market-demo-share-token',
  checkoutText: process.env.TIXMO_PUBLIC_CHECKOUT_TEXT || 'Harborlight Summer Session',
  reviewText: process.env.TIXMO_PUBLIC_REVIEW_TEXT || 'Harborlight campaign artwork',
  shareText: process.env.TIXMO_PUBLIC_SHARE_TEXT || 'Secure folder share',
  chromePath: process.env.TIXMO_CHROME_PATH || '',
  requirePolicies: process.env.TIXMO_PUBLIC_EVIDENCE_REQUIRE_POLICIES === 'true',
};

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

const findChrome = () => {
  const candidates = [
    config.chromePath,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);

  const result = candidates.find((candidate) => {
    if (candidate.includes('/')) return fs.existsSync(candidate);
    const lookup = spawnSync('which', [candidate], { encoding: 'utf8' });
    return lookup.status === 0;
  });

  if (!result) {
    throw new Error('Chrome/Chromium was not found. Set TIXMO_CHROME_PATH to a headless-capable browser.');
  }

  if (result.includes('/')) return result;

  const lookup = spawnSync('which', [result], { encoding: 'utf8' });
  return lookup.stdout.trim();
};

const dashboardBaseUrl = normalizeBaseUrl(config.dashboardUrl, 'TIXMO_DASHBOARD_URL');
const outputDir = path.resolve(config.outputDir);
const chromePath = findChrome();
const startedAt = new Date().toISOString();
const userDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tixmo-public-evidence-'));

const routes = [
  {
    id: 'checkout',
    pathname: `/checkout/${encodeURIComponent(config.checkoutSlug)}`,
    expectedText: [
      config.checkoutText,
      'Order summary',
    ],
    policyText: [
      'Terms of Service',
      'Refund Policy',
      'Privacy Policy',
    ],
    allowedFallbackText: 'Checkout is blocked until approved Terms, Refund Policy, and Privacy Policy URLs are configured.',
  },
  {
    id: 'review',
    pathname: `/review/${encodeURIComponent(config.reviewToken)}`,
    expectedText: [
      'Review Portal',
      config.reviewText,
    ],
  },
  {
    id: 'shared-assets',
    pathname: `/assets/shared/${encodeURIComponent(config.shareToken)}`,
    expectedText: [
      config.shareText,
      'Assets',
    ],
  },
];

const viewports = [
  { id: 'desktop', width: 1440, height: 1100 },
  { id: 'mobile', width: 390, height: 844 },
];

const ensureText = (route, dom) => {
  const missing = route.expectedText.filter((text) => !dom.includes(text));
  if (missing.length) return missing;

  if (route.id === 'checkout') {
    const missingPolicyText = route.policyText.filter((text) => !dom.includes(text));
    const hasFallback = route.allowedFallbackText && dom.includes(route.allowedFallbackText);

    if (config.requirePolicies && missingPolicyText.length) return missingPolicyText;
    if (!config.requirePolicies && missingPolicyText.length && !hasFallback) return missingPolicyText;
  }

  return [];
};

const captureRoute = (route, viewport) => {
  const url = new URL(route.pathname, `${dashboardBaseUrl}/`).toString();
  const screenshotPath = path.join(outputDir, `${route.id}-${viewport.id}.png`);
  const userDataDir = path.join(userDataRoot, `${route.id}-${viewport.id}`);

  fs.mkdirSync(userDataDir, { recursive: true });
  fs.rmSync(screenshotPath, { force: true });

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-extensions',
    '--disable-sync',
    '--disable-features=MediaRouter',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    '--force-device-scale-factor=1',
    '--timeout=6000',
    `--screenshot=${screenshotPath}`,
    '--dump-dom',
    url,
  ];

  const result = spawnSync(chromePath, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 15000,
  });

  const screenshotExists = fs.existsSync(screenshotPath);
  const timedOutAfterOutput = result.error?.code === 'ETIMEDOUT' && screenshotExists;

  if (result.status !== 0 && !timedOutAfterOutput) {
    const detail = result.stderr || result.stdout || `Chrome exited ${result.status}`;
    throw new Error(`${route.id} ${viewport.id} capture failed: ${detail.trim()}`);
  }

  const missingText = ensureText(route, result.stdout || '');
  const stats = fs.statSync(screenshotPath);

  if (missingText.length) {
    throw new Error(`${route.id} ${viewport.id} missing expected text: ${missingText.join(', ')}`);
  }

  if (stats.size < 5000) {
    throw new Error(`${route.id} ${viewport.id} screenshot is unexpectedly small: ${stats.size} bytes`);
  }

  process.stdout.write(`[evidence:public-routes] pass ${route.id} ${viewport.id} ${stats.size} bytes\n`);

  return {
    route: route.id,
    url,
    viewport,
    screenshot: screenshotPath,
    bytes: stats.size,
    checkedText: route.expectedText,
    policyLinksRequired: route.id === 'checkout' ? config.requirePolicies : undefined,
  };
};

try {
  fs.mkdirSync(outputDir, { recursive: true });

  const captures = [];
  routes.forEach((route) => {
    viewports.forEach((viewport) => {
      captures.push(captureRoute(route, viewport));
    });
  });

  const manifest = {
    startedAt,
    finishedAt: new Date().toISOString(),
    dashboardUrl: dashboardBaseUrl,
    chromePath,
    result: 'pass',
    captures,
  };
  const manifestPath = path.join(outputDir, 'public-route-evidence.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`[evidence:public-routes] manifest written ${manifestPath}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[evidence:public-routes] ${message}\n`);
  process.exitCode = 1;
} finally {
  fs.rmSync(userDataRoot, { recursive: true, force: true });
}
