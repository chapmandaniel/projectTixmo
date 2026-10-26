import { transporter, emailFrom } from '../config/email';
import { config } from '../config/environment';
import { logger } from '../config/logger';
import {
  orderConfirmationEmail,
  ticketTransferEmail,
  eventReminderEmail,
  welcomeEmail,
  type OrderConfirmationData,
} from './emailTemplates';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class NotificationService {
  async sendBuyerPasswordChanged(to: string): Promise<boolean> {
    try {
      await transporter.sendMail({
        from: `${emailFrom.name} <${emailFrom.address}>`,
        to,
        subject: 'Your Tixmo buyer password changed',
        html: '<p>Your buyer password was changed and existing sessions were signed out. If you did not make this change, request a new password reset from the buyer sign-in page.</p>',
        text: 'Your buyer password was changed and existing sessions were signed out. If you did not make this change, request a new password reset from the buyer sign-in page.',
      });
      return true;
    } catch {
      logger.warn('Buyer password change notification was not confirmed');
      return false;
    }
  }
  // Recovery transport must not log provider exceptions: they may contain the link/body.
  async sendBuyerPasswordReset(to: string, link: string): Promise<boolean> {
    try {
      await transporter.sendMail({
        from: `${emailFrom.name} <${emailFrom.address}>`,
        to,
        subject: 'Reset your Tixmo buyer password',
        html: `<p>Use this single-use link within 15 minutes to choose a new buyer password.</p><p><a href="${link}">Reset buyer password</a></p><p>If you did not request this, ignore this email.</p>`,
        text: `Choose a new buyer password within 15 minutes: ${link}\nIf you did not request this, ignore this email.`,
      });
      return true;
    } catch {
      logger.warn('Buyer password recovery delivery was not confirmed');
      return false;
    }
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      await transporter.sendMail({
        from: `${emailFrom.name} <${emailFrom.address}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      logger.info(`Email sent to ${options.to}: ${options.subject}`);
      return true;
    } catch (error) {
      logger.error(`Error sending email: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(
    data: OrderConfirmationData & {
      to: string;
    }
  ): Promise<boolean> {
    const template = orderConfirmationEmail(
      {
        customerName: data.customerName,
        orderNumber: data.orderNumber,
        eventName: data.eventName,
        eventDate: data.eventDate,
        ticketSummary: data.ticketSummary,
        subtotalAmount: data.subtotalAmount,
        totalAmount: data.totalAmount,
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        hstNumber: data.hstNumber,
        hstAmountLine: data.hstAmountLine,
      },
      config.clientUrl
    );

    return await this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send ticket transfer notification
   */
  async sendTicketTransfer(data: {
    to: string;
    recipientName: string;
    senderName: string;
    eventName: string;
    eventDate: string;
    ticketCount: number;
    venueName?: string | null;
    venueAddress?: string | null;
  }): Promise<boolean> {
    const template = ticketTransferEmail(
      {
        recipientName: data.recipientName,
        senderName: data.senderName,
        eventName: data.eventName,
        eventDate: data.eventDate,
        ticketCount: data.ticketCount,
        venueName: data.venueName,
        venueAddress: data.venueAddress,
      },
      config.clientUrl
    );

    return await this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send event reminder
   */
  async sendEventReminder(data: {
    to: string;
    customerName: string;
    eventName: string;
    eventDate: string;
    venueName: string;
    venueAddress: string;
  }): Promise<boolean> {
    const template = eventReminderEmail({
      customerName: data.customerName,
      eventName: data.eventName,
      eventDate: data.eventDate,
      venueName: data.venueName,
      venueAddress: data.venueAddress,
    });

    return await this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(data: { to: string; name: string }): Promise<boolean> {
    const template = welcomeEmail({ name: data.name });

    return await this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send an alert to administrators for critical issues
   */
  async sendAdminAlert(subject: string, message: string): Promise<boolean> {
    const adminEmail = (await import('../config/environment')).config.adminEmail;

    return await this.sendEmail({
      to: adminEmail,
      subject: `🚨 [ALERT] ${subject}`,
      html: `<h2>System Alert</h2><p>${message}</p>`,
      text: `System Alert: ${message}`,
    });
  }
}

export const notificationService = new NotificationService();
