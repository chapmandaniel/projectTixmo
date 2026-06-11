#!/usr/bin/env node

const timeoutMs = Number(process.env.TIXMO_STATUS_TIMEOUT_MS || 8000);
const retries = Number(process.env.TIXMO_STATUS_RETRIES || 1);

const usage = `Usage:
  npm run status:check
  TIXMO_API_BASE_URL=https://api.example.com npm run status:check
  TIXMO_STATUS_URLS=https://api.example.com/health,https://app.example.com npm run status:check
  node ./scripts/check-status.mjs https://api.example.com/health https://app.example.com

Environment:
  TIXMO_API_BASE_URL       Base API origin. Checks /health and /api/v1/health.
  TIXMO_DASHBOARD_URL     Dashboard origin to check.
  TIXMO_STATUS_URLS       Comma-separated explicit URLs.
  TIXMO_STATUS_TIMEOUT_MS Request timeout in milliseconds. Default: 8000.
  TIXMO_STATUS_RETRIES    Retries per URL after first failure. Default: 1.
`;

const normalizeUrl = (value) => {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
};

const buildTargets = () => {
  const cliTargets = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(usage);
    process.exit(0);
  }

  if (cliTargets.length > 0) {
    return cliTargets;
  }

  if (process.env.TIXMO_STATUS_URLS) {
    return process.env.TIXMO_STATUS_URLS.split(',').map((url) => url.trim()).filter(Boolean);
  }

  const targets = [];
  const apiBaseUrl = process.env.TIXMO_API_BASE_URL || process.env.API_BASE_URL;
  const dashboardUrl = process.env.TIXMO_DASHBOARD_URL || process.env.DASHBOARD_URL;

  if (apiBaseUrl) {
    targets.push(new URL('/health', apiBaseUrl).toString());
    targets.push(new URL('/api/v1/health', apiBaseUrl).toString());
  }

  if (dashboardUrl) {
    targets.push(dashboardUrl);
  }

  return targets;
};

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'tixmo-status-check/1.0',
      },
    });

    const durationMs = Date.now() - startedAt;
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    let json = null;

    if (contentType.includes('application/json')) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Response advertised JSON but could not be parsed');
      }
    }

    return {
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      durationMs,
      json,
      preview: text.slice(0, 120).replace(/\s+/g, ' ').trim(),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const checkTarget = async (url) => {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await fetchWithTimeout(url);

      if (result.ok) {
        process.stdout.write(`[status:check] ok ${url} ${result.status} ${result.durationMs}ms\n`);
        return true;
      }

      lastError = new Error(`HTTP ${result.status}${result.preview ? `: ${result.preview}` : ''}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries) {
      process.stdout.write(`[status:check] retry ${url} after ${lastError.message}\n`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  process.stderr.write(`[status:check] fail ${url}: ${lastError?.message || 'unknown error'}\n`);
  return false;
};

const rawTargets = buildTargets();
const targets = [...new Set(rawTargets.map(normalizeUrl).filter(Boolean))];

if (targets.length === 0) {
  process.stderr.write('[status:check] no valid targets configured\n\n');
  process.stderr.write(usage);
  process.exit(1);
}

let allOk = true;
for (const target of targets) {
  // Sequential checks keep output readable and avoid bursty alerts.
  const ok = await checkTarget(target);
  allOk = allOk && ok;
}

if (!allOk) {
  process.exit(1);
}

