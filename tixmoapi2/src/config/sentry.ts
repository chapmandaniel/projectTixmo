import { assetShareLogPath } from '../utils/assetShareLogPath';
import { buyerRecoveryLogPath } from '../utils/buyerRecoveryLogPath';
import { redactGiveawayLogText } from '../utils/giveawayLogRedaction';
import * as Sentry from '@sentry/node';
import { config } from './environment';

type TelemetryRequest = {
  url?: string;
  data?: unknown;
  query_string?: unknown;
  headers?: Record<string, string>;
  cookies?: unknown;
};

type TelemetryBreadcrumb = {
  data?: Record<string, unknown>;
};

export const isBrandProtectionRequestUrl = (value: unknown): boolean => {
  if (typeof value !== 'string' || !value) return false;
  try {
    return new URL(value, 'https://redaction.invalid').pathname
      .toLowerCase()
      .includes('/brand-protection');
  } catch {
    return value.toLowerCase().includes('/brand-protection');
  }
};

const pathnameOnly = (value: string): string => {
  try {
    return new URL(value, 'https://redaction.invalid').pathname;
  } catch {
    return value.split('?')[0];
  }
};

const stripAuthAndCookies = (headers: Record<string, string> | undefined) => {
  if (!headers) return;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'cookie') {
      delete headers[key];
    }
  }
};

/** Drop checker bodies, queries, authorization, and cookies before they reach Sentry. */
export const scrubBrandProtectionRequest = <T extends { request?: TelemetryRequest }>(
  event: T
): T => {
  const request = event.request;
  if (!request || !isBrandProtectionRequestUrl(request.url)) return event;
  request.url = pathnameOnly(request.url || '');
  delete request.data;
  delete request.query_string;
  delete request.cookies;
  stripAuthAndCookies(request.headers);
  return event;
};

type BrandProtectionEvent = {
  message?: unknown;
  exception?: { values?: Array<{ value?: string }> };
  request?: TelemetryRequest;
};

const brandProtectionEvent = (event: BrandProtectionEvent): boolean =>
  isBrandProtectionRequestUrl(event.request?.url) ||
  (typeof event.message === 'string' && isBrandProtectionRequestUrl(event.message));

/** Redact checker evidence in exception text for brand-protection events, and scrub the request. */
export const scrubBrandProtectionEvent = <T extends BrandProtectionEvent>(event: T): T => {
  if (!brandProtectionEvent(event)) return event;
  scrubBrandProtectionRequest(event);
  if (typeof event.message === 'string') event.message = redactGiveawayLogText(event.message);
  for (const entry of event.exception?.values ?? []) {
    if (typeof entry.value === 'string') entry.value = redactGiveawayLogText(entry.value);
  }
  return event;
};

export const scrubBrandProtectionBreadcrumb = <T extends TelemetryBreadcrumb>(breadcrumb: T): T => {
  const data = breadcrumb.data;
  if (!data) return breadcrumb;
  const url = typeof data.url === 'string' ? data.url : '';
  if (!isBrandProtectionRequestUrl(url)) return breadcrumb;
  data.url = pathnameOnly(url);
  delete data.body;
  delete data.data;
  delete data.query_string;
  delete data.cookies;
  if (data.headers && typeof data.headers === 'object') {
    stripAuthAndCookies(data.headers as Record<string, string>);
  }
  return breadcrumb;
};

// Initialize Sentry only if DSN is provided
export function initSentry() {
  if (!config.sentryDsn) return;

  const dsn = String(config.sentryDsn).trim();
  // Skip obvious placeholders or malformed DSNs
  if (dsn === '' || dsn.toLowerCase().startsWith('your_') || !dsn.includes('://')) return;

  try {
    const release = config.release || undefined;
    const deploymentEnvironment = config.deploymentEnvironment || config.nodeEnv;
    const alertRoute = config.sentryAlertRoute || 'unassigned';

    Sentry.init({
      dsn: dsn,
      environment: deploymentEnvironment,
      tracesSampleRate: config.sentryTracesSampleRate ?? 0.0,
      release,
      integrations: [
        // enable automatic tracing for outbound HTTP requests
        new Sentry.Integrations.Http({ tracing: true }),
        // Do not create an Express integration here because the app instance
        // is created elsewhere (in app.ts). We attach Sentry middleware in app.ts
        // via Sentry.Handlers.requestHandler()/tracingHandler().
      ],
      beforeSend(event: unknown) {
        const ev = event as Sentry.Event;
        ev.tags = {
          ...(ev.tags || {}),
          service: config.serviceName,
          deployment_environment: deploymentEnvironment,
          alert_route: alertRoute,
          ...(release ? { release } : {}),
        };
        if (release && !ev.release) {
          ev.release = release;
        }

        // Recovery and public bearer URLs must never enter error telemetry.
        const request = ev.request;
        const sensitivePath = buyerRecoveryLogPath(request?.url) || assetShareLogPath(request?.url);
        if (request && sensitivePath) {
          request.url = sensitivePath;
          delete request.data;
          delete request.query_string;
          delete request.headers;
          delete request.cookies;
        }
        scrubBrandProtectionEvent(ev);
        // Existing general password scrubbing remains in place.
        try {
          if (ev && typeof ev === 'object' && 'request' in ev) {
            const req = (ev as Record<string, unknown>).request;
            if (req && typeof req === 'object' && 'data' in req) {
              const data = (req as Record<string, unknown>).data;
              if (
                data &&
                typeof data === 'object' &&
                'password' in (data as Record<string, unknown>)
              ) {
                const copy = { ...(data as Record<string, unknown>) };
                delete (copy as Record<string, unknown>).password;
                (req as Record<string, unknown>).data = copy;
              }
            }
          }
        } catch (e) {
          // ignore any errors during scrubbing
        }
        return ev;
      },
      beforeBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
        return scrubBrandProtectionBreadcrumb(breadcrumb);
      },
      beforeSendTransaction(event: Sentry.Event) {
        return scrubBrandProtectionRequest(event);
      },
    });

    Sentry.setTags({
      service: config.serviceName,
      deployment_environment: deploymentEnvironment,
      alert_route: alertRoute,
      ...(release ? { release } : {}),
    });
    Sentry.setContext('deployment', {
      service: config.serviceName,
      environment: deploymentEnvironment,
      release: release || 'unreleased',
      alertRoute,
    });
  } catch (e) {
    // Don't allow Sentry init failures to crash or spam test output
    // Use console.debug for low-importance message so it doesn't appear as error in tests
    // (logger may not be initialized yet)
    // eslint-disable-next-line no-console
    console.debug(
      'Sentry initialization skipped or failed:',
      e && (e as Error).message ? (e as Error).message : e
    );
  }
}

export { Sentry };
