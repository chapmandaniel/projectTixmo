import { ticketTransferEmail } from '../../src/utils/emailTemplates';
import { formatNewfoundlandDateTime } from '../../src/utils/eventTime';
import { NotificationService } from '../../src/utils/notificationService';

jest.mock('../../src/config/environment', () => ({
  config: {
    clientUrl: 'https://configured-dashboard.example.test',
    supportEmail: 'info@tixmo.co',
  },
}));
jest.mock('../../src/config/email', () => ({ transporter: {}, emailFrom: {} }));
jest.mock('../../src/config/logger', () => ({ logger: {} }));

describe('ticket transfer email', () => {
  it('renders Newfoundland start time, venue, and the wallet link', () => {
    const nst = formatNewfoundlandDateTime(new Date('2026-11-09T22:30:00.000Z'));
    const ndt = formatNewfoundlandDateTime(new Date('2026-10-31T22:30:00.000Z'));
    expect(nst).toBe('November 9, 2026 at 7:00 p.m. NST');
    expect(ndt).toBe('October 31, 2026 at 8:00 p.m. NDT');
    const email = ticketTransferEmail(
      {
        recipientName: 'Riley <script>',
        senderName: 'Sam & Co',
        eventName: 'Night show',
        eventDate: nst,
        ticketCount: 1,
        venueName: 'Signal Hall',
        venueAddress: "1 Harbour Dr, St. John's",
      },
      'https://configured-dashboard.example.test'
    );
    expect(email.html).toContain('November 9, 2026 at 7:00 p.m. NST');
    expect(email.html).not.toContain('11/20/2026');
    expect(email.html).toContain('Signal Hall');
    expect(email.html).toContain('1 Harbour Dr, St. John&#39;s');
    expect(email.html).toContain('href="https://configured-dashboard.example.test/wallet"');
    expect(email.html).toContain('Riley &lt;script&gt;');
    expect(email.html).toContain('<h1>Tickets sent to you</h1>');
    expect(email.html).toContain('Sam &amp; Co sent you 1 ticket(s) for:');
    expect(email.html).not.toContain('has transferred');
    expect(email.html).not.toContain('Tickets Transferred');
    expect(email.html).toContain(
      'Sign in to Tixmo and open My tickets. Show the QR code at the door. Each ticket gets one person in, once.'
    );
    expect(email.html).not.toContain('The tickets are now available in your Tixmo account.');
    expect(email.html).toContain('Questions? <a href="mailto:info@tixmo.co">info@tixmo.co</a>');
    expect(email.html).toContain('Tixmo · Ticketing for live events.');
    expect(email.html).not.toContain("Please don't reply");
    expect(email.html).not.toContain('Event Ticketing Platform');
    expect(email.text).toContain('Tickets sent to you');
    expect(email.text).toContain('Sam & Co sent you 1 ticket(s) for:');
    expect(email.text).not.toContain('has transferred');
    expect(email.text).toContain(
      'Sign in to Tixmo and open My tickets. Show the QR code at the door. Each ticket gets one person in, once.'
    );
    expect(email.text).toContain('Questions? info@tixmo.co');
    expect(email.text).toContain('Tixmo · Ticketing for live events.');
    expect(email.text).not.toContain("Please don't reply");
    expect(email.text).not.toContain('Event Ticketing Platform');
    expect(email.text).toContain('November 9, 2026 at 7:00 p.m. NST');
    expect(email.text).toContain("Venue: Signal Hall, 1 Harbour Dr, St. John's");
    expect(email.text).toContain('https://configured-dashboard.example.test/wallet');
  });

  it('uses a supplied support email and falls back when it is invalid', () => {
    const base = {
      recipientName: 'Riley',
      senderName: 'Sam',
      eventName: 'Night show',
      eventDate: 'November 9, 2026 at 7:00 p.m. NST',
      ticketCount: 2,
      venueName: 'Signal Hall',
      venueAddress: '1 Harbour Dr',
    };
    const custom = ticketTransferEmail(
      { ...base, supportEmail: ' desk@tixmo.co ' },
      'https://configured-dashboard.example.test'
    );
    const invalid = ticketTransferEmail(
      { ...base, supportEmail: 'not-an-email' },
      'https://configured-dashboard.example.test'
    );
    expect(custom.html).toContain('sent you 2 ticket(s) for:');
    expect(custom.html).toContain('Questions? <a href="mailto:desk@tixmo.co">desk@tixmo.co</a>');
    expect(custom.text).toContain('Questions? desk@tixmo.co');
    expect(invalid.html).toContain('mailto:info@tixmo.co');
    expect(invalid.text).toContain('Questions? info@tixmo.co');
    expect(invalid.html).not.toContain('not-an-email');
    expect(invalid.text).not.toContain('not-an-email');
  });

  it('the notification caller uses the configured client, not a caller-supplied url', async () => {
    const service = new NotificationService();
    const send = jest.spyOn(service, 'sendEmail').mockResolvedValue(true);
    await service.sendTicketTransfer({
      to: 'buyer@example.test',
      recipientName: 'Riley',
      senderName: 'Sam',
      eventName: 'Night show',
      eventDate: 'November 9, 2026 at 7:00 p.m. NST',
      ticketCount: 1,
      venueName: 'Signal Hall',
      venueAddress: '1 Harbour Dr',
      ...{ clientUrl: 'https://attacker.example.test' },
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('href="https://configured-dashboard.example.test/wallet"'),
        text: expect.stringContaining('https://configured-dashboard.example.test/wallet'),
      })
    );
    const sent = send.mock.calls[0][0];
    expect(sent.html).toContain('Sam sent you 1 ticket(s) for:');
    expect(sent.html).toContain('Questions? <a href="mailto:info@tixmo.co">info@tixmo.co</a>');
    expect(sent.text).toContain('Questions? info@tixmo.co');
    expect(sent.text).toContain('Tickets sent to you');
  });
});
