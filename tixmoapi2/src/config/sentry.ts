import * as Sentry from '@sentry/node';
import { config } from './environment';

// Initialize Sentry only if DSN is provided
export function initSentry() {
  if (!config.sentryDsn) return;

  const dsn = String(config.sentryDsn).trim();
  // Skip obvious placeholders or malformed DSNs
  if (dsn === '' || dsn.toLowerCase().startsWith('your_') || !dsn.includes('://')) return;

  try {
    Sentry.init({
      dsn: dsn,
      environment: config.nodeEnv,
      tracesSampleRate: config.sentryTracesSampleRate ?? 0.0,
      release: config.release || undefined,
      integrations: [
        // enable automatic tracing for outbound HTTP requests
        new Sentry.Integrations.Http({ tracing: true }),
        // Do not create an Express integration here because the app instance
        // is created elsewhere (in app.ts). We attach Sentry middleware in app.ts
        // via Sentry.Handlers.requestHandler()/tracingHandler().
      ],
      beforeSend(event: unknown) {
        // Scrub PII or large payloads here if needed
        try {
          if (event && typeof event === 'object' && 'request' in event) {
            const ev = event as Record<string, unknown>;
            const req = ev.request;
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
        return event as Sentry.Event;
      },
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
