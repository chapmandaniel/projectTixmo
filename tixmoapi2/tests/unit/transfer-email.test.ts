import { ticketTransferEmail } from '../../src/utils/emailTemplates';
import { formatNewfoundlandDateTime } from '../../src/utils/eventTime';
import { NotificationService } from '../../src/utils/notificationService';

jest.mock('../../src/config/environment', () => ({
  config: { clientUrl: 'https://configured-dashboard.example.test' },
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
    expect(email.text).toContain('November 9, 2026 at 7:00 p.m. NST');
    expect(email.text).toContain("Venue: Signal Hall, 1 Harbour Dr, St. John's");
    expect(email.text).toContain('https://configured-dashboard.example.test/wallet');
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
  });
});
