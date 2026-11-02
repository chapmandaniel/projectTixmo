import * as https from 'node:https';
import nodemailer, { TransportOptions } from 'nodemailer';
import { config } from './environment';
import { logger } from './logger';
import { MailDeliveryError } from '../services/email-delivery';

type EmailAddress = string | { name?: string; address: string };

type SendMailOptions = {
  from?: EmailAddress;
  to: EmailAddress | EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
  tag?: string;
};

type MailTransport = {
  sendMail(options: SendMailOptions): Promise<{ messageId?: string }>;
  verify(): Promise<boolean>;
};

type PostmarkSendResponse = {
  MessageID?: string;
  ErrorCode?: number;
  Message?: string;
};

const POSTMARK_API_HOST = 'api.postmarkapp.com';

function postmarkField(response: PostmarkSendResponse | undefined): {
  errorCode: string;
  messageId: string;
} {
  const errorCode =
    response && Number.isInteger(response.ErrorCode) ? String(response.ErrorCode) : 'missing';
  const messageId =
    typeof response?.MessageID === 'string' && response.MessageID.trim()
      ? response.MessageID.trim()
      : 'missing';
  return { errorCode, messageId };
}

/** Every Postmark send records both fields. A missing id or a non-zero code is not success. */
function logPostmarkSend(response: PostmarkSendResponse | undefined, accepted: boolean): void {
  const { errorCode, messageId } = postmarkField(response);
  const line = `Postmark send ErrorCode=${errorCode} MessageID=${messageId}`;
  if (accepted) logger.info(line);
  else logger.error(line);
}

function postmarkAcceptance(
  response: PostmarkSendResponse | undefined
): { ok: true } | { ok: false; delivery: 'REJECTED' | 'UNCERTAIN'; reason: string } {
  if (response && Number.isInteger(response.ErrorCode) && (response.ErrorCode || 0) > 0) {
    return {
      ok: false,
      delivery: 'REJECTED',
      reason: `Postmark explicitly rejected the message (${response.ErrorCode}).`,
    };
  }
  if (
    !response ||
    response.ErrorCode !== 0 ||
    typeof response.MessageID !== 'string' ||
    !response.MessageID.trim() ||
    response.MessageID.length > 255 ||
    [...response.MessageID].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  ) {
    return {
      ok: false,
      delivery: 'UNCERTAIN',
      reason: 'Postmark email acceptance was not confirmed by a message ID.',
    };
  }
  return { ok: true };
}

const formatAddress = (value: EmailAddress) => {
  if (typeof value === 'string') {
    return value;
  }

  return value.name ? `${value.name} <${value.address}>` : value.address;
};

const formatRecipients = (value: EmailAddress | EmailAddress[]) => {
  const recipients = Array.isArray(value) ? value : [value];
  return recipients.map(formatAddress).join(',');
};

const postmarkRequest = <T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
) => {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const request = https.request(
      {
        hostname: POSTMARK_API_HOST,
        port: 443,
        path,
        method,
        headers: {
          Accept: 'application/json',
          'X-Postmark-Server-Token': config.postmarkServerToken,
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (response) => {
        let raw = '';
        let responseBytes = 0;

        response.setEncoding('utf8');
        response.on('error', () =>
          reject(
            new MailDeliveryError(
              'Postmark response failed before acceptance was established.',
              'UNCERTAIN'
            )
          )
        );
        response.on('aborted', () =>
          reject(new MailDeliveryError('Postmark response was interrupted.', 'UNCERTAIN'))
        );
        response.on('data', (chunk) => {
          const text = String(chunk);
          responseBytes += Buffer.byteLength(text);
          if (responseBytes > 1024 * 1024) {
            const failure = new MailDeliveryError(
              'Postmark response exceeded its allowed size.',
              'UNCERTAIN'
            );
            reject(failure);
            request.destroy(failure);
          } else raw += text;
        });
        response.on('end', () => {
          const statusCode = response.statusCode ?? 500;
          let parsed: T | PostmarkSendResponse;
          try {
            parsed = raw ? (JSON.parse(raw) as T | PostmarkSendResponse) : {};
          } catch {
            reject(
              new MailDeliveryError(
                'Postmark returned an invalid response.',
                statusCode >= 400 && statusCode < 500 ? 'REJECTED' : 'UNCERTAIN',
                statusCode === 429
              )
            );
            return;
          }

          if (statusCode >= 200 && statusCode < 300) {
            resolve(parsed as T);
            return;
          }

          const failure = new MailDeliveryError(
            `Postmark API request failed (${statusCode}).`,
            statusCode >= 400 && statusCode < 500 ? 'REJECTED' : 'UNCERTAIN',
            statusCode === 429
          );
          if (path === '/email' && parsed && typeof parsed === 'object') {
            Object.assign(failure, { postmark: parsed });
          }
          reject(failure);
        });
      }
    );

    request.on('error', (error) =>
      reject(
        error instanceof MailDeliveryError
          ? error
          : new MailDeliveryError(
              'Postmark request failed before acceptance was established.',
              'UNCERTAIN'
            )
      )
    );
    deadline = setTimeout(() => {
      const failure = new MailDeliveryError(
        'Postmark API request exceeded its total deadline; acceptance is unknown.',
        'UNCERTAIN'
      );
      reject(failure);
      request.destroy(failure);
    }, 10000);
    deadline.unref();
    request.setTimeout(10000, () => {
      request.destroy(
        new MailDeliveryError('Postmark API request timed out; acceptance is unknown.', 'UNCERTAIN')
      );
    });

    if (payload) {
      request.write(payload);
    }

    request.end();
  }).finally(() => {
    if (deadline) clearTimeout(deadline);
  });
};

const wrapNodemailerTransport = (
  transport: ReturnType<typeof nodemailer.createTransport>
): MailTransport => ({
  async sendMail(options) {
    const info = await transport.sendMail({
      from: options.from ? formatAddress(options.from) : formatAddress(emailFrom),
      to: formatRecipients(options.to),
      subject: options.subject,
      html: options.html,
      text: options.text,
      headers: options.headers,
    });

    return {
      messageId: typeof info?.messageId === 'string' ? info.messageId : undefined,
    };
  },
  async verify() {
    await transport.verify();
    return true;
  },
});

const createJsonTransport = (): MailTransport => {
  const testTransport: TransportOptions = {
    jsonTransport: true,
  } as TransportOptions;

  return wrapNodemailerTransport(nodemailer.createTransport(testTransport));
};

function createTransport(): MailTransport {
  const hasSmtpCreds = Boolean(config.emailUser && config.emailPassword);
  const hasPostmarkServerToken = Boolean(config.postmarkServerToken);
  const isTest = config.nodeEnv === 'test';

  if (isTest) {
    logger.info(
      `Email transport using jsonTransport (env=${config.nodeEnv}, hasCreds=${hasSmtpCreds})`
    );
    return createJsonTransport();
  }

  if (hasPostmarkServerToken) {
    logger.info('Email transport using Postmark API derived from POSTMARK_SERVER_TOKEN');

    return {
      async sendMail(options) {
        let response: PostmarkSendResponse | undefined;
        try {
          response = await postmarkRequest<PostmarkSendResponse>('POST', '/email', {
            From: formatAddress(options.from || emailFrom),
            To: formatRecipients(options.to),
            Subject: options.subject,
            HtmlBody: options.html,
            TextBody: options.text,
            MessageStream: config.postmarkMessageStream || 'outbound',
            Headers: Object.entries(options.headers || {}).map(([Name, Value]) => ({
              Name,
              Value,
            })),
            Metadata: options.metadata,
            Tag: options.tag,
          });
        } catch (error) {
          const parsed =
            error && typeof error === 'object' && 'postmark' in error
              ? (error as { postmark?: PostmarkSendResponse }).postmark
              : undefined;
          logPostmarkSend(parsed, false);
          throw error;
        }

        const accepted = postmarkAcceptance(response);
        logPostmarkSend(response, accepted.ok);
        if (!accepted.ok) {
          throw new MailDeliveryError(accepted.reason, accepted.delivery);
        }

        return {
          messageId: response.MessageID,
        };
      },
      async verify() {
        await postmarkRequest('GET', '/server');
        return true;
      },
    };
  }

  if (!hasSmtpCreds) {
    if (config.nodeEnv === 'production') {
      logger.warn('Production email transport is disabled because no provider is configured.');
      return {
        async sendMail() {
          throw new MailDeliveryError('No production email provider is configured.', 'REJECTED');
        },
        async verify() {
          throw new MailDeliveryError('No production email provider is configured.', 'REJECTED');
        },
      };
    }
    logger.info(
      `Email transport using jsonTransport (env=${config.nodeEnv}, hasCreds=${hasSmtpCreds}, hasPostmark=${hasPostmarkServerToken})`
    );

    return createJsonTransport();
  }

  const emailConfig = {
    host: config.emailHost || 'smtp.gmail.com',
    port: config.emailPort || 587,
    secure: false,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: config.emailUser,
      pass: config.emailPassword,
    },
  };

  logger.info(`Email transport using SMTP host ${emailConfig.host}:${emailConfig.port}`);

  return wrapNodemailerTransport(nodemailer.createTransport(emailConfig));
}

export const emailFrom = {
  name: config.fromName,
  address: config.fromEmail || config.emailFrom || 'noreply@tixmo.co',
};

export const transporter = createTransport();

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    logger.info('Email server is ready to send messages');
    return true;
  } catch (error) {
    logger.error(`Email server connection error: ${(error as Error).message}`);
    return false;
  }
}
