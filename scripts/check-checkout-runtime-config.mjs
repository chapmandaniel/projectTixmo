#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const timeoutMs = Number(process.env.TIXMO_CHECKOUT_CONFIG_TIMEOUT_MS || 12000);

const usage = `Usage:
  TIXMO_DASHBOARD_URL=https://app.example.com npm run evidence:checkout-config

Optional environment:
  TIXMO_DASHBOARD_URL                     Dashboard origin. Default: http://127.0.0.1:5173
  TIXMO_CHECKOUT_CONFIG_EVIDENCE_PATH     JSON output path. Default: docs/checkout-config-evidence/runtime-config-evidence.json
  TIXMO_EXPECTED_API_URL                  Expected runtime apiUrl. Optional.
  TIXMO_EXPECTED_PAYMENT_CURRENCY         Expected payment currency. Default: usd
  TIXMO_REQUIRE_POLICY_URLS               Require privacy/terms/refund URLs. Default: true
  TIXMO_REQUIRE_STRIPE_PUBLISHABLE_KEY    Require stripePublishableKey. Default: true
  TIXMO_VERIFY_POLICY_URLS                Fetch policy URLs and require 2xx/3xx. Default: false
  TIXMO_CHECKOUT_CONFIG_TIMEOUT_MS        Request timeout in milliseconds. Default: 12000.
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(usage);
  process.exit(0);
}

const booleanEnv = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value === 'true';
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

const normalizeCurrency = (value) => String(value || '').trim().toLowerCase();
const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const redactKey = (value) => {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 12) return '<redacted>';
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
};

const config = {
  dashboardUrl: normalizeBaseUrl(
    process.env.TIXMO_DASHBOARD_URL || 'http://127.0.0.1:5173',
    'TIXMO_DASHBOARD_URL'
  ),
  evidencePath:
    process.env.TIXMO_CHECKOUT_CONFIG_EVIDENCE_PATH ||
    'docs/checkout-config-evidence/runtime-config-evidence.json',
  expectedApiUrl: process.env.TIXMO_EXPECTED_API_URL || '',
  expectedPaymentCurrency: normalizeCurrency(
    process.env.TIXMO_EXPECTED_PAYMENT_CURRENCY || process.env.PAYMENT_CURRENCY || 'usd'
  ),
  requirePolicyUrls: booleanEnv('TIXMO_REQUIRE_POLICY_URLS', true),
  requireStripePublishableKey: booleanEnv('TIXMO_REQUIRE_STRIPE_PUBLISHABLE_KEY', true),
  verifyPolicyUrls: booleanEnv('TIXMO_VERIFY_POLICY_URLS', false),
};

const evidence = {
  startedAt: new Date().toISOString(),
  dashboardUrl: config.dashboardUrl,
  runtimeConfigUrl: new URL('/runtime-config.js', `${config.dashboardUrl}/`).toString(),
  checks: [],
  config: {},
  result: 'running',
};

const record = (name, status, details = {}) => {
  evidence.checks.push({
    name,
    status,
    at: new Date().toISOString(),
    ...details,
  });
  process.stdout.write(`[evidence:checkout-config] ${status} ${name}${details.summary ? ` ${details.summary}` : ''}\n`);
};

const requestText = async (name, url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'application/javascript,text/javascript,text/plain,*/*;q=0.8',
        'user-agent': 'tixmo-checkout-config-evidence/1.0',
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    const durationMs = Date.now() - startedAt;

    if (response.status < 200 || response.status >= 400) {
      throw new Error(`${name} returned HTTP ${response.status}: ${text.slice(0, 180)}`);
    }

    record(name, 'pass', {
      httpStatus: response.status,
      durationMs,
      summary: `${response.status} ${durationMs}ms`,
    });

    return { response, text, durationMs };
  } finally {
    clearTimeout(timeout);
  }
};

const parseRuntimeConfig = (source) => {
  const sandbox = {
    window: {},
  };
  sandbox.window.__TIXMO_CONFIG__ = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, {
    timeout: 1000,
    displayErrors: false,
  });

  return sandbox.window.__TIXMO_CONFIG__ || {};
};

const requireTruthy = (name, value) => {
  if (!value) {
    throw new Error(`${name} is missing`);
  }
  record(name, 'pass');
};

const verifyPolicyUrl = async (name, value) => {
  const url = normalizeUrl(value);
  if (!url && !config.requirePolicyUrls) {
    record(`${name} skipped`, 'pass', { summary: 'not required' });
    return;
  }

  try {
    new URL(url);
  } catch {
    throw new Error(`${name} is not a valid URL: ${value}`);
  }

  if (!config.verifyPolicyUrls) {
    record(`${name} url format`, 'pass', { summary: url });
    return;
  }

  await requestText(`${name} reachable`, url, {
    method: 'GET',
    headers: { accept: 'text/html,text/plain,*/*;q=0.8' },
  });
};

const writeEvidence = () => {
  evidence.finishedAt = new Date().toISOString();
  const outputPath = path.resolve(config.evidencePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`[evidence:checkout-config] evidence written ${outputPath}\n`);
};

try {
  const runtime = await requestText('runtime config fetch', evidence.runtimeConfigUrl);
  const runtimeConfig = parseRuntimeConfig(runtime.text);

  evidence.config = {
    apiUrl: runtimeConfig.apiUrl || '',
    privacyPolicyUrl: runtimeConfig.privacyPolicyUrl || '',
    termsUrl: runtimeConfig.termsUrl || '',
    refundPolicyUrl: runtimeConfig.refundPolicyUrl || '',
    organizerTermsUrl: runtimeConfig.organizerTermsUrl || '',
    stripePublishableKey: redactKey(runtimeConfig.stripePublishableKey),
    paymentCurrency: runtimeConfig.paymentCurrency || '',
  };

  if (config.expectedApiUrl) {
    const actual = normalizeUrl(runtimeConfig.apiUrl);
    const expected = normalizeUrl(config.expectedApiUrl);
    if (actual !== expected) {
      throw new Error(`apiUrl mismatch: expected ${expected}, got ${actual || '<empty>'}`);
    }
    record('apiUrl matches expected', 'pass', { summary: expected });
  }

  if (config.requirePolicyUrls) {
    requireTruthy('privacyPolicyUrl present', runtimeConfig.privacyPolicyUrl);
    requireTruthy('termsUrl present', runtimeConfig.termsUrl);
    requireTruthy('refundPolicyUrl present', runtimeConfig.refundPolicyUrl);
  }

  await verifyPolicyUrl('privacyPolicyUrl', runtimeConfig.privacyPolicyUrl);
  await verifyPolicyUrl('termsUrl', runtimeConfig.termsUrl);
  await verifyPolicyUrl('refundPolicyUrl', runtimeConfig.refundPolicyUrl);

  if (config.requireStripePublishableKey) {
    requireTruthy('stripePublishableKey present', runtimeConfig.stripePublishableKey);
    if (!String(runtimeConfig.stripePublishableKey).startsWith('pk_')) {
      throw new Error('stripePublishableKey must start with pk_');
    }
    record('stripePublishableKey format', 'pass', { summary: redactKey(runtimeConfig.stripePublishableKey) });
  }

  const actualCurrency = normalizeCurrency(runtimeConfig.paymentCurrency || 'usd');
  if (actualCurrency !== config.expectedPaymentCurrency) {
    throw new Error(
      `paymentCurrency mismatch: expected ${config.expectedPaymentCurrency}, got ${actualCurrency || '<empty>'}`
    );
  }
  record('paymentCurrency matches expected', 'pass', { summary: actualCurrency });

  evidence.result = 'pass';
  writeEvidence();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  evidence.result = 'fail';
  record('checkout runtime config evidence', 'fail', { summary: message });
  writeEvidence();
  process.exit(1);
}
