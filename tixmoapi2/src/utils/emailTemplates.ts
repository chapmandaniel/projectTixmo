// Email template types
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Order confirmation email
export function orderConfirmationEmail(data: {
  customerName: string;
  orderNumber: string;
  eventName: string;
  eventDate: string;
  ticketCount: number;
  totalAmount: string;
}): EmailTemplate {
  return {
    subject: `Order Confirmation - ${data.eventName}`,
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
              <h1>Order Confirmed!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.customerName},</p>
              <p>Thank you for your order! Your tickets are confirmed.</p>
              <div class="details">
                <p><strong>Order Number:</strong> ${data.orderNumber}</p>
                <p><strong>Event:</strong> ${data.eventName}</p>
                <p><strong>Date:</strong> ${data.eventDate}</p>
                <p><strong>Tickets:</strong> ${data.ticketCount}</p>
                <p><strong>Total:</strong> $${data.totalAmount}</p>
              </div>
              <p>Your tickets will be available in your account shortly.</p>
            </div>
            <div class="footer">
              <p>TixMo - Event Ticketing Platform</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Order Confirmed!
      
      Hi ${data.customerName},
      
      Thank you for your order! Your tickets are confirmed.
      
      Order Number: ${data.orderNumber}
      Event: ${data.eventName}
      Date: ${data.eventDate}
      Tickets: ${data.ticketCount}
      Total: $${data.totalAmount}
      
      Your tickets will be available in your account shortly.
      
      TixMo - Event Ticketing Platform
    `,
  };
}

// Ticket transfer email
export function ticketTransferEmail(data: {
  recipientName: string;
  senderName: string;
  eventName: string;
  eventDate: string;
  ticketCount: number;
}): EmailTemplate {
  return {
    subject: `Ticket Transfer - ${data.eventName}`,
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
              <h1>Tickets Transferred to You!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.recipientName},</p>
              <p>${data.senderName} has transferred ${data.ticketCount} ticket(s) to you for:</p>
              <p><strong>${data.eventName}</strong></p>
              <p>Date: ${data.eventDate}</p>
              <p>The tickets are now available in your TixMo account.</p>
            </div>
            <div class="footer">
              <p>TixMo - Event Ticketing Platform</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Tickets Transferred to You!
      
      Hi ${data.recipientName},
      
      ${data.senderName} has transferred ${data.ticketCount} ticket(s) to you for:
      ${data.eventName}
      Date: ${data.eventDate}
      
      The tickets are now available in your TixMo account.
      
      TixMo - Event Ticketing Platform
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
    subject: `Reminder: ${data.eventName} is Coming Up!`,
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
              <p>TixMo - Event Ticketing Platform</p>
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
      
      TixMo - Event Ticketing Platform
    `,
  };
}

// Welcome email
export function welcomeEmail(data: { name: string }): EmailTemplate {
  return {
    subject: 'Welcome to TixMo!',
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
              <h1>Welcome to TixMo!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.name},</p>
              <p>Welcome to TixMo! We're excited to have you on board.</p>
              <p>With TixMo, you can easily discover and purchase tickets for amazing events.</p>
              <p>Start exploring events now!</p>
            </div>
            <div class="footer">
              <p>TixMo - Event Ticketing Platform</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Welcome to TixMo!
      
      Hi ${data.name},
      
      Welcome to TixMo! We're excited to have you on board.
      
      With TixMo, you can easily discover and purchase tickets for amazing events.
      
      Start exploring events now!
      
      TixMo - Event Ticketing Platform
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
    subject: 'You have been invited to TixMo',
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
              <h1>Welcome to TixMo!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.name},</p>
              <p>An account has been created for you on TixMo.</p>
              
              <p><strong>Username:</strong> ${data.email}</p>
              ${passwordSection}
              
              <a href="${data.loginUrl}" class="button">Log In to TixMo</a>
            </div>
            <div class="footer">
              <p>TixMo - Event Ticketing Platform</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Welcome to TixMo!
      
      Hi ${data.name},
      
      An account has been created for you on TixMo.
      
      Username: ${data.email}
      ${passwordText}
      
      Log in here: ${data.loginUrl}
      
      TixMo - Event Ticketing Platform
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
              <p>TixMo - Creative Approvals</p>
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
      
      TixMo - Creative Approvals
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
              <p>TixMo - Creative Approvals</p>
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
      
      TixMo - Creative Approvals
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
              <p>TixMo - Creative Approvals</p>
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
      
      TixMo - Creative Approvals
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
              <p>TixMo - Creative Approvals</p>
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
      
      TixMo - Creative Approvals
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
              <p>TixMo - Creative Approvals</p>
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

      TixMo - Creative Approvals
    `,
  };
}
