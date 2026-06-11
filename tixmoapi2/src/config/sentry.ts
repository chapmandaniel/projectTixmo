import * as Sentry from '@sentry/node';
import { config } from './environment';

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

        // Scrub PII or large payloads here if needed
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
