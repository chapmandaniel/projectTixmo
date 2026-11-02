import { assetShareLogPath } from '../utils/assetShareLogPath';
import { buyerRecoveryLogPath } from '../utils/buyerRecoveryLogPath';
import * as Sentry from '@sentry/node';
import { config } from './environment';

const SECRET_KEY =
  /^(api[_-]?key|apikey|secret|webhook[_-]?secret|webhooksecret|token|authorization|password|passwd|credential|credentials|cookie|cookies|set-cookie|x-showpass-signature)$/i;
const BUYER_KEY =
  /^(customer_name|customer_email|customer_phone_number|barcode_string|email_on_ticket|first_name_on_ticket|last_name_on_ticket|name_on_ticket|phone_number_on_ticket)$/i;

export const isShowpassRequestUrl = (value: unknown): boolean => {
  if (typeof value !== 'string' || !value) return false;
  try {
    return new URL(value, 'https://redaction.invalid').pathname
      .toLowerCase()
      .includes('/showpass/');
  } catch {
    return value.toLowerCase().includes('/showpass/');
  }
};

const pathnameOnly = (value: string): string => {
  try {
    return new URL(value, 'https://redaction.invalid').pathname;
  } catch {
    return value.split('?')[0];
  }
};

const scrubKeys = (value: unknown, buyer: boolean, seen = new WeakSet<object>()): void => {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) scrubKeys(item, buyer, seen);
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (SECRET_KEY.test(key) || (buyer && BUYER_KEY.test(key))) {
      delete record[key];
      continue;
    }
    scrubKeys(record[key], buyer, seen);
  }
};

type TelemetryRequest = {
  url?: string;
  data?: unknown;
  query_string?: unknown;
  headers?: Record<string, unknown>;
  cookies?: unknown;
};

/** Drop Showpass bodies and strip secret-shaped keys before they reach Sentry. */
export const scrubShowpassEvent = <T extends { request?: TelemetryRequest; message?: unknown }>(
  event: T
): T => {
  const showpass = isShowpassRequestUrl(event.request?.url);
  const request = event.request;
  if (request && showpass) {
    request.url = pathnameOnly(request.url || '');
    delete request.data;
    delete request.query_string;
    delete request.headers;
    delete request.cookies;
  }
  scrubKeys(event, showpass);
  return event;
};

export const scrubShowpassBreadcrumb = <T extends { data?: Record<string, unknown> }>(
  breadcrumb: T
): T => {
  const data = breadcrumb.data;
  if (!data) return breadcrumb;
  const url = typeof data.url === 'string' ? data.url : '';
  if (isShowpassRequestUrl(url)) {
    data.url = pathnameOnly(url);
    delete data.body;
    delete data.data;
    delete data.query_string;
    delete data.cookies;
    delete data.headers;
  }
  scrubKeys(breadcrumb, isShowpassRequestUrl(url) || isShowpassRequestUrl(data.url));
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
        scrubShowpassEvent(ev);
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
        return scrubShowpassBreadcrumb(breadcrumb);
      },
      beforeSendTransaction(event: Sentry.Event) {
        return scrubShowpassEvent(event);
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
