import * as https from 'node:https';
import nodemailer, { TransportOptions } from 'nodemailer';
import { config } from './environment';
import { logger } from './logger';

type EmailAddress = string | { name?: string; address: string };

type SendMailOptions = {
  from?: EmailAddress;
  to: EmailAddress | EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
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

const postmarkRequest = <T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>) =>
  new Promise<T>((resolve, reject) => {
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

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          const statusCode = response.statusCode ?? 500;
          const parsed = raw ? (JSON.parse(raw) as T | PostmarkSendResponse) : ({} as T);

          if (statusCode >= 200 && statusCode < 300) {
            resolve(parsed as T);
            return;
          }

          const message =
            typeof parsed === 'object' && parsed && 'Message' in parsed && typeof parsed.Message === 'string'
              ? parsed.Message
              : `Postmark API request failed with status ${statusCode}`;

          reject(new Error(message));
        });
      }
    );

    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy(new Error('Postmark API request timed out'));
    });

    if (payload) {
      request.write(payload);
    }

    request.end();
  });

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
    logger.info(`Email transport using jsonTransport (env=${config.nodeEnv}, hasCreds=${hasSmtpCreds})`);
    return createJsonTransport();
  }

  if (hasPostmarkServerToken) {
    logger.info('Email transport using Postmark API derived from POSTMARK_SERVER_TOKEN');

    return {
      async sendMail(options) {
        const response = await postmarkRequest<PostmarkSendResponse>('POST', '/email', {
          From: formatAddress(options.from || emailFrom),
          To: formatRecipients(options.to),
          Subject: options.subject,
          HtmlBody: options.html,
          TextBody: options.text,
          MessageStream: config.postmarkMessageStream || 'outbound',
          Headers: Object.entries(options.headers || {}).map(([Name, Value]) => ({ Name, Value })),
        });

        if (response.ErrorCode && response.ErrorCode !== 0) {
          throw new Error(response.Message || `Postmark API error ${response.ErrorCode}`);
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
    logger.info(
      `Email transport using jsonTransport (env=${config.nodeEnv}, hasCreds=${hasSmtpCreds}, hasPostmark=${hasPostmarkServerToken})`
    );

    return createJsonTransport();
  }

  const emailConfig = {
    host: config.emailHost || 'smtp.gmail.com',
    port: config.emailPort || 587,
    secure: false,
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
  address: config.fromEmail || config.emailFrom || 'noreply@tixmo.com',
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
