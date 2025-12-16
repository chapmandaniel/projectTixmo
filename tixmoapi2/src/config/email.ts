import nodemailer, { TransportOptions } from 'nodemailer';
import { config } from './environment';
import { logger } from './logger';

// Decide transport based on environment/credentials
function createTransport() {
  const hasSmtpCreds = Boolean(config.emailUser && config.emailPassword);
  const isTest = config.nodeEnv === 'test';

  if (isTest || !hasSmtpCreds) {
    // Test/dev-safe transport: does not send real emails
    const testTransport: TransportOptions = {
      jsonTransport: true,
    } as TransportOptions;

    logger.info(
      `Email transport using jsonTransport (env=${config.nodeEnv}, hasCreds=${hasSmtpCreds})`
    );

    return nodemailer.createTransport(testTransport);
  }

  // Real SMTP transport
  const emailConfig = {
    host: config.emailHost || 'smtp.gmail.com',
    port: config.emailPort || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: config.emailUser,
      pass: config.emailPassword,
    },
  };

  return nodemailer.createTransport(emailConfig);
}

// Create reusable transporter
export const transporter = createTransport();

// Verify connection configuration
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

// Email sender info
export const emailFrom = {
  name: 'TixMo',
  address: config.emailFrom || 'noreply@tixmo.com',
};
