import { transporter, emailFrom } from '../config/email';
import { logger } from '../config/logger';
import {
  orderConfirmationEmail,
  ticketTransferEmail,
  eventReminderEmail,
  welcomeEmail,
} from './emailTemplates';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class NotificationService {
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
  async sendOrderConfirmation(data: {
    to: string;
    customerName: string;
    orderNumber: string;
    eventName: string;
    eventDate: string;
    ticketCount: number;
    totalAmount: string;
  }): Promise<boolean> {
    const template = orderConfirmationEmail({
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      eventName: data.eventName,
      eventDate: data.eventDate,
      ticketCount: data.ticketCount,
      totalAmount: data.totalAmount,
    });

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
  }): Promise<boolean> {
    const template = ticketTransferEmail({
      recipientName: data.recipientName,
      senderName: data.senderName,
      eventName: data.eventName,
      eventDate: data.eventDate,
      ticketCount: data.ticketCount,
    });

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
