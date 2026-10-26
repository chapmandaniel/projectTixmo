// Email template types
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const escapeReceiptHtml = (value: string | number): string =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });

// Only the server-configured CLIENT_URL is supplied by NotificationService.
// Never accept an order/customer-provided destination, or carry URL credentials/tokens.
const receiptWalletUrl = (clientUrl: string): string | undefined => {
  try {
    if (!clientUrl || /[\s\\]/.test(clientUrl)) return undefined;
    const base = new URL(clientUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if (
      (base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return undefined;
    return new URL('/wallet', base).toString();
  } catch {
    // Preserve the receipt and existing account guidance if configuration is unusable.
    return undefined;
  }
};

export interface OrderConfirmationData {
  customerName: string;
  orderNumber: string;
  eventName: string;
  eventDate: string;
  ticketSummary: string;
  subtotalAmount?: string | null;
  totalAmount: string;
  venueName?: string | null;
  venueAddress?: string | null;
  hstNumber?: string | null;
  hstAmountLine?: string | null;
  sellerName?: string | null;
  supportEmail?: string | null;
  refundPolicyUrl?: string | null;
  termsUrl?: string | null;
}

// Published policy pages only. Anything else is omitted from the receipt.
const receiptPolicyUrl = (value: string | null | undefined): string | undefined => {
  try {
    if (typeof value !== 'string') return undefined;
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
};

const receiptSupportEmail = (value: string | null | undefined): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return /^[^\s@<>"']+@[^\s@<>"']+$/.test(trimmed) ? trimmed : 'info@tixmo.co';
};

const receiptVenue = (data: OrderConfirmationData): string => {
  const line = [data.venueName?.trim(), data.venueAddress?.trim()].filter(Boolean).join(', ');
  return line || 'Venue to be announced';
};

// Order confirmation email
export function orderConfirmationEmail(
  data: OrderConfirmationData,
  clientUrl: string
): EmailTemplate {
  const walletUrl = receiptWalletUrl(clientUrl);
  const venue = receiptVenue(data);
  const hstNumber = data.hstNumber?.trim() || '';
  const hstAmountLine = data.hstAmountLine?.trim() || '';
  const hstHtml = hstNumber ? `<p>HST no. ${escapeReceiptHtml(hstNumber)}</p>` : '';
  const hstText = hstNumber ? `HST no. ${hstNumber}\n` : '';
  const hstAmountHtml = hstAmountLine ? `<p>${escapeReceiptHtml(hstAmountLine)}</p>` : '';
  const hstAmountText = hstAmountLine ? `${hstAmountLine}\n` : '';
  const walletHtml = walletUrl
    ? `<p><a href="${escapeReceiptHtml(walletUrl)}">View your tickets</a>. Sign in with the account used for this order.</p>`
    : '';
  const walletText = walletUrl
    ? `View your tickets: ${walletUrl}\nSign in with the account used for this order.\n`
    : '';
  const seller = data.sellerName?.trim() || '';
  const sellerHtml = seller ? `<p>Sold by ${escapeReceiptHtml(seller)}</p>` : '';
  const sellerText = seller ? `Sold by ${seller}\n` : '';
  const support = receiptSupportEmail(data.supportEmail);
  const supportHtml = escapeReceiptHtml(support);
  const refundUrl = receiptPolicyUrl(data.refundPolicyUrl);
  const termsUrl = receiptPolicyUrl(data.termsUrl);
  const policyLinks = [
    refundUrl ? `<a href="${escapeReceiptHtml(refundUrl)}">Refund policy</a>` : '',
    termsUrl ? `<a href="${escapeReceiptHtml(termsUrl)}">Terms of Sale</a>` : '',
  ].filter(Boolean);
  const policyHtml = policyLinks.length ? ` ${policyLinks.join(' · ')}` : '';
  const policyTextParts = [
    refundUrl ? `Refund policy: ${refundUrl}` : '',
    termsUrl ? `Terms: ${termsUrl}` : '',
  ].filter(Boolean);
  const policyText = policyTextParts.length ? `${policyTextParts.join(' · ')}\n` : '';
  const total = escapeReceiptHtml(data.totalAmount);
  const subtotal = data.subtotalAmount?.trim() ? escapeReceiptHtml(data.subtotalAmount.trim()) : '';
  const subtotalHtml = subtotal ? `<p><strong>Subtotal:</strong> ${subtotal}</p>` : '';
  const subtotalText = data.subtotalAmount?.trim()
    ? `Subtotal: ${data.subtotalAmount.trim()}\n`
    : '';
  return {
    subject: `Your Tixmo tickets for ${data.eventName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order confirmed</h1>
            </div>
            <div class="content">
              <p>Hi ${escapeReceiptHtml(data.customerName)}, your order is confirmed.</p>
              <div class="details">
                <p><strong>Order:</strong> ${escapeReceiptHtml(data.orderNumber)}</p>
                <p><strong>Event:</strong> ${escapeReceiptHtml(data.eventName)}</p>
                <p><strong>When:</strong> ${escapeReceiptHtml(data.eventDate)}</p>
                <p><strong>Where:</strong> ${escapeReceiptHtml(venue)}</p>
                <p><strong>Tickets:</strong> ${escapeReceiptHtml(data.ticketSummary)}</p>
                ${subtotalHtml}
                <p><strong>Total paid:</strong> ${total} (includes HST and all fees)</p>
                ${hstAmountHtml}
                ${hstHtml}
                ${sellerHtml}
              </div>
              ${walletHtml}
              <p>All sales are final unless the event is cancelled or rescheduled.${policyHtml}</p>
              <p>Questions? <a href="mailto:${supportHtml}">${supportHtml}</a></p>
            </div>
            <div class="footer">
              <p>Tixmo · Ticketing for live events. Please don't reply to this email. Contact <a href="mailto:${supportHtml}">${supportHtml}</a>.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${data.customerName}, your order is confirmed.

      Order: ${data.orderNumber}
      Event: ${data.eventName}
      When: ${data.eventDate}
      Where: ${venue}
      Tickets: ${data.ticketSummary}
      ${subtotalText}Total paid: ${data.totalAmount} (includes HST and all fees)
      ${hstAmountText}${hstText}${sellerText}${walletText}
      All sales are final unless the event is cancelled or rescheduled.
      ${policyText}Questions? ${support}

      Tixmo · Ticketing for live events. Please don't reply to this email. Contact ${support}.
    `,
  };
}

// Ticket transfer email
export function ticketTransferEmail(
  data: {
    recipientName: string;
    senderName: string;
    eventName: string;
    eventDate: string;
    ticketCount: number;
    venueName?: string | null;
    venueAddress?: string | null;
    supportEmail?: string | null;
  },
  clientUrl: string
): EmailTemplate {
  const support = receiptSupportEmail(data.supportEmail);
  const supportHtml = escapeReceiptHtml(support);
  const when = escapeReceiptHtml(data.eventDate);
  const venue = escapeReceiptHtml(
    [data.venueName?.trim(), data.venueAddress?.trim()].filter(Boolean).join(', ') ||
      'Venue to be announced'
  );
  const venueText =
    [data.venueName?.trim(), data.venueAddress?.trim()].filter(Boolean).join(', ') ||
    'Venue to be announced';
  const walletUrl = receiptWalletUrl(clientUrl);
  const walletHtml = walletUrl
    ? `<p><a href="${escapeReceiptHtml(walletUrl)}">View your tickets</a></p>`
    : '';
  const walletText = walletUrl ? `View your tickets: ${walletUrl}\n` : '';
  return {
    subject: `A Tixmo ticket for ${data.eventName} was sent to you`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Tickets sent to you</h1>
            </div>
            <div class="content">
              <p>Hi ${escapeReceiptHtml(data.recipientName)},</p>
              <p>${escapeReceiptHtml(data.senderName)} sent you ${data.ticketCount} ticket(s) for:</p>
              <p><strong>${escapeReceiptHtml(data.eventName)}</strong></p>
              <p>Date: ${when}</p>
              <p>Venue: ${venue}</p>
              ${walletHtml}
              <p>Sign in to Tixmo and open My tickets. Show the QR code at the door. Each ticket gets one person in, once.</p>
              <p>Questions? <a href="mailto:${supportHtml}">${supportHtml}</a></p>
            </div>
            <div class="footer">
              <p>Tixmo · Ticketing for live events. Please don't reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Tickets sent to you
      
      Hi ${data.recipientName},
      
      ${data.senderName} sent you ${data.ticketCount} ticket(s) for:
      ${data.eventName}
      Date: ${data.eventDate}
      Venue: ${venueText}
      ${walletText}
      Sign in to Tixmo and open My tickets. Show the QR code at the door. Each ticket gets one person in, once.
      Questions? ${support}
      
      Tixmo · Ticketing for live events. Please don't reply to this email.
    `,
  };
}

// Event reminder email
export function eventReminderEmail(data: {
  customerName: string;
  eventName: string;
  eventDate: string;
  venueName: string;
  venueAddress: string;
}): EmailTemplate {
  return {
    subject: `Reminder: ${data.eventName} is coming up`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Event Reminder</h1>
            </div>
            <div class="content">
              <p>Hi ${data.customerName},</p>
              <p>This is a reminder that you have tickets for:</p>
              <p><strong>${data.eventName}</strong></p>
              <p><strong>Date:</strong> ${data.eventDate}</p>
              <p><strong>Venue:</strong> ${data.venueName}</p>
              <p><strong>Address:</strong> ${data.venueAddress}</p>
              <p>Don't forget to bring your tickets!</p>
            </div>
            <div class="footer">
              <p>Tixmo - Event Ticketing Platform</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Event Reminder
      
      Hi ${data.customerName},
      
      This is a reminder that you have tickets for:
      ${data.eventName}
      Date: ${data.eventDate}
      Venue: ${data.venueName}
      Address: ${data.venueAddress}
      
      Don't forget to bring your tickets!
      
      Tixmo - Event Ticketing Platform
    `,
  };
}

// Welcome email
export function welcomeEmail(data: { name: string }): EmailTemplate {
  return {
    subject: 'Welcome to Tixmo',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Tixmo!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.name},</p>
              <p>Welcome to Tixmo! We're excited to have you on board.</p>
              <p>With Tixmo, you can easily discover and purchase tickets for amazing events.</p>
              <p>Start exploring events now!</p>
            </div>
            <div class="footer">
              <p>Tixmo - Event Ticketing Platform</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Welcome to Tixmo!
      
      Hi ${data.name},
      
      Welcome to Tixmo! We're excited to have you on board.
      
      With Tixmo, you can easily discover and purchase tickets for amazing events.
      
      Start exploring events now!
      
      Tixmo - Event Ticketing Platform
    `,
  };
}
// User invitation email
export function userInvitationEmail(data: {
  name: string;
  email: string;
  password?: string;
  loginUrl: string;
}): EmailTemplate {
  const passwordSection = data.password
    ? `
    <div style="background-color: #f3f4f6; padding: 10px; margin: 10px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: bold;">Temporary Password:</p>
      <p style="margin: 5px 0; font-family: monospace; font-size: 16px;">${data.password}</p>
    </div>
    <p>Please change your password after logging in.</p>
    `
    : '';

  const passwordText = data.password
    ? `
    Temporary Password: ${data.password}
    
    Please change your password after logging in.
    `
    : '';

  return {
    subject: 'You have been invited to Tixmo',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Tixmo!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.name},</p>
              <p>An account has been created for you on Tixmo.</p>
              
              <p><strong>Username:</strong> ${data.email}</p>
              ${passwordSection}
              
              <a href="${data.loginUrl}" class="button">Log In to Tixmo</a>
            </div>
            <div class="footer">
              <p>Tixmo - Event Ticketing Platform</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Welcome to Tixmo!
      
      Hi ${data.name},
      
      An account has been created for you on Tixmo.
      
      Username: ${data.email}
      ${passwordText}
      
      Log in here: ${data.loginUrl}
      
      Tixmo - Event Ticketing Platform
    `,
  };
}

// ==============================================
// APPROVAL SYSTEM EMAIL TEMPLATES
// ==============================================

// New approval request email (sent to reviewers)
export function approvalRequestEmail(data: {
  reviewerName: string;
  requesterName: string;
  title: string;
  eventName: string;
  description?: string;
  deadline: string;
  revisionNumber: number;
  reviewUrl: string;
}): EmailTemplate {
  return {
    subject: `Review requested: ${data.title}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 25px; background-color: white; }
            .details { background-color: #f9fafb; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #4F46E5; }
            .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; color: white; background-color: #4F46E5; }
            .button { display: inline-block; padding: 14px 28px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Review Requested</h1>
            </div>
            <div class="content">
              <p>Hi ${data.reviewerName},</p>
              <p><strong>${data.requesterName}</strong> has requested your feedback on:</p>
              
              <div class="details">
                <p style="margin: 0 0 10px 0;"><strong>${data.title}</strong></p>
                <p style="margin: 0 0 10px 0;">Event: ${data.eventName}</p>
                ${data.description ? `<p style="margin: 0 0 10px 0;">${data.description}</p>` : ''}
                <p style="margin: 0;">
                  <span class="priority-badge">Revision ${data.revisionNumber}</span>
                  <span style="margin-left: 10px;">Deadline: ${data.deadline}</span>
                </p>
              </div>
              
              <p>Click below to review the assets and provide your feedback:</p>
              <a href="${data.reviewUrl}" class="button">Review Now →</a>
              
              <p style="margin-top: 25px; color: #6b7280; font-size: 14px;">This link expires in 30 days.</p>
            </div>
            <div class="footer">
              <p>Tixmo - Creative Approvals</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Review Requested
      
      Hi ${data.reviewerName},
      
      ${data.requesterName} has requested your feedback on:
      
      Title: ${data.title}
      Event: ${data.eventName}
      ${data.description ? `Description: ${data.description}` : ''}
      Revision: ${data.revisionNumber}
      Deadline: ${data.deadline}
      
      Review here: ${data.reviewUrl}
      
      This link expires in 30 days.
      
      Tixmo - Creative Approvals
    `,
  };
}

// Approval reminder email
export function approvalReminderEmail(data: {
  reviewerName: string;
  requesterName: string;
  title: string;
  eventName: string;
  deadline: string;
  revisionNumber: number;
  reviewUrl: string;
}): EmailTemplate {
  return {
    subject: `⏰ Reminder: Review Pending - ${data.title}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #F59E0B; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 25px; background-color: white; }
            .button { display: inline-block; padding: 14px 28px; background-color: #F59E0B; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Review Reminder</h1>
            </div>
            <div class="content">
              <p>Hi ${data.reviewerName},</p>
              <p>This is a friendly reminder that your review is still pending for:</p>
              <p><strong>${data.title}</strong> (${data.eventName})</p>
              <p>Revision: <strong>${data.revisionNumber}</strong></p>
              <p>Deadline: <strong>${data.deadline}</strong></p>
              <p>${data.requesterName} is waiting for your feedback.</p>
              <a href="${data.reviewUrl}" class="button">Complete Review →</a>
            </div>
            <div class="footer">
              <p>Tixmo - Creative Approvals</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Review Reminder
      
      Hi ${data.reviewerName},
      
      This is a reminder that your review is pending for:
      ${data.title} (${data.eventName})
      Revision: ${data.revisionNumber}
      Deadline: ${data.deadline}
      
      ${data.requesterName} is waiting for your feedback.
      
      Review here: ${data.reviewUrl}
      
      Tixmo - Creative Approvals
    `,
  };
}

// Approval decision notification (sent to requester)
export function approvalDecisionEmail(data: {
  requesterName: string;
  reviewerName: string;
  title: string;
  eventName: string;
  revisionNumber: number;
  decision: 'APPROVED' | 'DECLINED' | 'CHANGES_REQUESTED';
  note?: string;
  dashboardUrl: string;
}): EmailTemplate {
  const decisionConfig = {
    APPROVED: { label: 'Approved ✅', color: '#10B981', headerBg: '#10B981' },
    DECLINED: { label: 'Declined ❌', color: '#EF4444', headerBg: '#EF4444' },
    CHANGES_REQUESTED: { label: 'Changes Requested ✏️', color: '#F59E0B', headerBg: '#F59E0B' },
  };
  const config = decisionConfig[data.decision];

  return {
    subject: `${config.label} - ${data.title}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${config.headerBg}; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 25px; background-color: white; }
            .decision { font-size: 24px; font-weight: bold; color: ${config.color}; margin: 15px 0; }
            .note { background-color: #f9fafb; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid ${config.color}; }
            .button { display: inline-block; padding: 14px 28px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Review Complete</h1>
            </div>
            <div class="content">
              <p>Hi ${data.requesterName},</p>
              <p><strong>${data.reviewerName}</strong> has reviewed:</p>
              <p><strong>${data.title}</strong> (${data.eventName})</p>
              <p>Revision ${data.revisionNumber}</p>
              <p class="decision">${config.label}</p>
              ${data.note ? `<div class="note"><strong>Note:</strong><br/>${data.note}</div>` : ''}
              <a href="${data.dashboardUrl}" class="button">View Details →</a>
            </div>
            <div class="footer">
              <p>Tixmo - Creative Approvals</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Review Complete
      
      Hi ${data.requesterName},
      
      ${data.reviewerName} has reviewed:
      ${data.title} (${data.eventName})
      Revision: ${data.revisionNumber}
      
      Decision: ${config.label}
      ${data.note ? `Note: ${data.note}` : ''}
      
      View details: ${data.dashboardUrl}
      
      Tixmo - Creative Approvals
    `,
  };
}

// New revision notification (sent to reviewers)
export function approvalRevisionEmail(data: {
  reviewerName: string;
  requesterName: string;
  title: string;
  eventName: string;
  deadline: string;
  revisionNumber: number;
  summary?: string;
  reviewUrl: string;
}): EmailTemplate {
  return {
    subject: `🔄 Revision available: ${data.title} (v${data.revisionNumber})`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #6366F1; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 25px; background-color: white; }
            .version-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; color: white; background-color: #6366F1; }
            .button { display: inline-block; padding: 14px 28px; background-color: #6366F1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Revision Available</h1>
            </div>
            <div class="content">
              <p>Hi ${data.reviewerName},</p>
              <p><strong>${data.requesterName}</strong> has submitted a revision for your review:</p>
              <p><strong>${data.title}</strong> (${data.eventName})</p>
              <p><span class="version-badge">Version ${data.revisionNumber}</span></p>
              ${data.summary ? `<p>${data.summary}</p>` : ''}
              <p>Deadline: ${data.deadline}</p>
              <p>Please review the updated assets and provide your feedback.</p>
              <a href="${data.reviewUrl}" class="button">Review Revision →</a>
            </div>
            <div class="footer">
              <p>Tixmo - Creative Approvals</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      New Revision Available
      
      Hi ${data.reviewerName},
      
      ${data.requesterName} has submitted a revision for your review:
      ${data.title} (${data.eventName})
      Version: ${data.revisionNumber}
      ${data.summary ? `Summary: ${data.summary}` : ''}
      Deadline: ${data.deadline}
      
      Please review the updated assets.
      
      Review here: ${data.reviewUrl}
      
      Tixmo - Creative Approvals
    `,
  };
}

export function approvalCommentEmail(data: {
  title: string;
  eventName: string;
  revisionNumber: number;
  authorName: string;
  comment: string;
  actionUrl: string;
  actionLabel: string;
}): EmailTemplate {
  return {
    subject: `New approval comment: ${data.title}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563EB; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 25px; background-color: white; }
            .note { background-color: #f9fafb; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #2563EB; }
            .button { display: inline-block; padding: 14px 28px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Comment</h1>
            </div>
            <div class="content">
              <p><strong>${data.authorName}</strong> commented on <strong>${data.title}</strong> (${data.eventName})</p>
              <p>Revision ${data.revisionNumber}</p>
              <div class="note">${data.comment}</div>
              <a href="${data.actionUrl}" class="button">${data.actionLabel} →</a>
            </div>
            <div class="footer">
              <p>Tixmo - Creative Approvals</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      New approval comment

      ${data.authorName} commented on ${data.title} (${data.eventName})
      Revision: ${data.revisionNumber}

      ${data.comment}

      View details: ${data.actionUrl}

      Tixmo - Creative Approvals
    `,
  };
}
