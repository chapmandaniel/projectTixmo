const ISO_CURRENCY = /^[a-z]{3}$/;

// Launch reads PAYMENT_CURRENCY. Production refuses to boot without it.
// Every other environment uses cad, never the historical database default of usd.
export function resolvePaymentCurrency(raw: string | undefined, nodeEnv: string): string {
  const trimmed = raw?.trim() || '';
  if (!trimmed) {
    if (nodeEnv === 'production') {
      throw new Error('Missing required environment variables: PAYMENT_CURRENCY');
    }
    if (nodeEnv !== 'test') {
      console.error(
        'PAYMENT_CURRENCY is not set; using cad. Refusing the database default of usd.'
      );
    }
    return 'cad';
  }
  const currency = trimmed.toLowerCase();
  if (!ISO_CURRENCY.test(currency)) {
    throw new Error('PAYMENT_CURRENCY must be a 3-letter ISO currency code');
  }
  return currency;
}
