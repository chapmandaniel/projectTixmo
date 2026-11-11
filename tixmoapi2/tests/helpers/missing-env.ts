import { format } from 'node:util';

// Same rejection as normalizeOptionalCredential: an example value is not a secret.
export function isUsableTestCredential(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return !(
    lower.includes('your_') ||
    lower.includes('_your') ||
    lower.includes('change-this') ||
    lower.includes('placeholder')
  );
}

export type MissingEnvNeed = {
  name: string;
  why: string;
  // Credentials treat placeholders as absent. Other values only need to be non-empty.
  kind?: 'credential' | 'value';
};

export const stripeWebhookTestNeeds: readonly MissingEnvNeed[] = [
  {
    name: 'STRIPE_SECRET_KEY',
    kind: 'credential',
    why: 'PaymentService builds its Stripe client from this key. Without it handleWebhook throws "Payment service is not configured", and the race harness then reports "Barrier timeout (harness failure)". CI sets synthetic sk_test_market_readiness, so these tests still run there.',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    kind: 'credential',
    why: 'Stripe.webhooks.generateTestHeaderString and constructEvent use this secret. CI sets synthetic whsec_market_readiness.',
  },
];

const capturedEnvName: Record<string, string> = {
  STRIPE_SECRET_KEY: 'TIXMO_CAPTURED_STRIPE_SECRET_KEY',
  STRIPE_WEBHOOK_SECRET: 'TIXMO_CAPTURED_STRIPE_WEBHOOK_SECRET',
  TIXMO_BROWSER_PATH: 'TIXMO_CAPTURED_BROWSER_PATH',
};

// setup.ts snapshots these before any test file writes a synthetic key.
const readEnv = (name: string): string | undefined => {
  if (process.env.TIXMO_TEST_ENV_CAPTURED === '1') {
    const captured = capturedEnvName[name];
    if (captured) return process.env[captured];
  }
  return process.env[name];
};

const isMissing = (need: MissingEnvNeed): boolean => {
  const raw = readEnv(need.name);
  if (need.kind === 'value') return !raw?.trim();
  return !isUsableTestCredential(raw);
};

const titleFor = (template: string, item: unknown): string => {
  const values = Array.isArray(item) ? item : [item];
  return format(template, ...(values as [unknown, ...unknown[]]));
};

/**
 * Returns Jest's real `test` when every requirement is present, so CI keeps
 * running the same cases. Otherwise returns a skip stand-in and prints why.
 */
export function testOrSkipMissingEnv(suite: string, needs: readonly MissingEnvNeed[]): typeof test {
  const missing = needs.filter(isMissing);
  if (missing.length === 0) return test;
  const why = missing.map((need) => `${need.name}: ${need.why}`).join('; ');
  const announce = (title: string) => {
    console.warn(`[skip] ${suite} › ${title} — ${why}`);
  };
  const skipped = (name: string, fn?: jest.ProvidesCallback, timeout?: number) => {
    announce(name);
    return test.skip(name, fn, timeout);
  };
  const each = (cases: readonly unknown[]) => {
    const register = test.skip.each(cases) as (
      name: string,
      fn?: jest.ProvidesCallback,
      timeout?: number
    ) => void;
    return (name: string, fn?: jest.ProvidesCallback, timeout?: number) => {
      for (const item of cases) announce(titleFor(name, item));
      return register(name, fn, timeout);
    };
  };
  return Object.assign(skipped, { each }) as typeof test;
}
