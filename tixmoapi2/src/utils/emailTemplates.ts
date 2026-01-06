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
