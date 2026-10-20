export class MailDeliveryError extends Error {
  constructor(
    message: string,
    readonly delivery: 'REJECTED' | 'UNCERTAIN',
    readonly retryable = false
  ) {
    super(message);
    this.name = 'MailDeliveryError';
  }
}

export type ReminderDeliveryResult =
  | { status: 'SENT'; messageId?: string }
  | { status: 'FAILED'; retryable: boolean; error: string }
  | { status: 'UNCERTAIN'; error: string };

export function classifyMailFailure(
  error: unknown
): Exclude<ReminderDeliveryResult, { status: 'SENT' }> {
  if (error instanceof MailDeliveryError) {
    return error.delivery === 'REJECTED'
      ? { status: 'FAILED', retryable: error.retryable, error: error.message }
      : { status: 'UNCERTAIN', error: error.message };
  }
  if (typeof error === 'object' && error && 'responseCode' in error) {
    const code = error.responseCode;
    if (typeof code === 'number' && code >= 400 && code < 600) {
      return {
        status: 'FAILED',
        retryable: code < 500,
        error: `SMTP explicitly rejected the message (${code}).`,
      };
    }
  }
  return {
    status: 'UNCERTAIN',
    error: 'Email acceptance could not be established. Provider reconciliation is required.',
  };
}
