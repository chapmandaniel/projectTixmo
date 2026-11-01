import { orderConfirmationEmail } from '../../src/utils/emailTemplates';
import { NotificationService } from '../../src/utils/notificationService';
import { formatHstAmountLine, formatMoney } from '../../src/utils/receipt';

jest.mock('../../src/config/environment', () => ({
  config: {
    clientUrl: 'https://configured-dashboard.example.test',
    sellerName: '',
    supportEmail: 'info@tixmo.co',
    refundPolicyUrl: '',
    termsUrl: '',
  },
}));
jest.mock('../../src/config/email', () => ({ transporter: {}, emailFrom: {} }));
jest.mock('../../src/config/logger', () => ({ logger: {} }));

const receipt = {
  customerName: 'Buyer <script>alert("x")</script>',
  orderNumber: 'ORDER-123',
  eventName: 'Test & Event',
  eventDate: '2026-11-09',
  ticketSummary: '2 × General Admission',
  subtotalAmount: formatMoney(25.5, 'CAD'),
  totalAmount: formatMoney(25.5, 'CAD'),
  venueName: 'Signal Hall',
  venueAddress: "1 Harbour Dr, St. John's",
  hstNumber: null as string | null,
  hstAmountLine: formatHstAmountLine(3.33, 0.15),
};

const renderReceipt = (base: string): ReturnType<typeof orderConfirmationEmail> =>
  Reflect.apply(orderConfirmationEmail, undefined, [receipt, base]);

describe('receipt wallet retrieval', () => {
  it('the notification caller uses server configuration, not a customer destination', async () => {
    const service = new NotificationService();
    const send = jest.spyOn(service, 'sendEmail').mockResolvedValue(true);
    await expect(
      service.sendOrderConfirmation({
        ...receipt,
        to: 'buyer@example.test',
        ...{ clientUrl: 'https://attacker.example.test', walletUrl: 'javascript:alert(1)' },
      })
    ).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('href="https://configured-dashboard.example.test/wallet"'),
        text: expect.stringContaining('https://configured-dashboard.example.test/wallet'),
      })
    );
    expect(JSON.stringify(send.mock.calls)).not.toContain('attacker.example.test');
  });
  it.each([
    'https://dashboard.example.test',
    'https://dashboard.example.test/',
    'https://dashboard.example.test/base/',
  ])('uses fixed wallet route on trusted base %s', (base) => {
    const email = renderReceipt(base);
    expect(email.html).toContain('href="https://dashboard.example.test/wallet"');
    expect(email.text).toContain('https://dashboard.example.test/wallet');
    expect(email.html).toContain('Sign in with the account used for this order');
    expect(email.text).toContain('Sign in with the account used for this order');
    expect(email.subject).toBe('Your Tixmo tickets for Test & Event');
    expect(receipt.subtotalAmount).toBe('CA$25.50');
    expect(receipt.totalAmount).toBe('CA$25.50');
    expect(receipt.hstAmountLine).toBe('Includes HST (15%): CA$3.33');
    expect(email.html).toContain('Subtotal:</strong> CA$25.50');
    expect(email.text).toContain('Subtotal: CA$25.50');
    expect(email.html).toContain('Total paid:</strong> CA$25.50 (includes HST and all fees)');
    expect(email.text).toContain('Total paid: CA$25.50 (includes HST and all fees)');
    expect(email.html).toContain('Includes HST (15%): CA$3.33');
    expect(email.text).toContain('Includes HST (15%): CA$3.33');
    expect(email.html).not.toMatch(/(?<!CA)\$\d/);
    expect(email.text).not.toMatch(/(?<!CA)\$\d/);
    expect(email.html).not.toMatch(/Total paid:<\/strong> \$/);
    expect(email.text).not.toMatch(/Total paid: \$/);
    expect(email.text).not.toContain('$CAD');
    expect(email.html).not.toContain('$CAD');
    expect(email.text).toContain("Where: Signal Hall, 1 Harbour Dr, St. John's");
    expect(email.text).toContain('Tickets: 2 × General Admission');
    expect(email.text).not.toContain('HST no.');
    expect(email.html).not.toContain('HST no.');
    expect(email.text).toContain('ORDER-123');
    expect(email.text).not.toContain('Your tickets will be available in your account shortly.');
    expect(email.html).not.toMatch(/qrCode|resetToken|accessToken|password=/i);
    expect(email.html).toContain('Sold by Tixmo Ltd.');
    expect(email.text).toContain('Sold by Tixmo Ltd.');
    expect(email.html).not.toContain('Quincy');
    expect(email.text).not.toContain('Quincy');
    expect(email.html).toContain('Questions? <a href="mailto:info@tixmo.co">info@tixmo.co</a>');
    expect(email.text).toContain('Questions? info@tixmo.co');
    expect(email.html).toContain(
      'Tixmo · Ticketing for live events. Contact <a href="mailto:info@tixmo.co">info@tixmo.co</a>.'
    );
    expect(email.html).not.toContain("Please don't reply");
    expect(email.text).toContain('Tixmo · Ticketing for live events. Contact info@tixmo.co.');
    expect(email.text).not.toContain("Please don't reply");
  });

  it('prints the HST registration number when it is configured', () => {
    const email = renderReceipt('https://dashboard.example.test');
    const disclosed = Reflect.apply(orderConfirmationEmail, undefined, [
      { ...receipt, hstNumber: '123456789RT0001<script>' },
      'https://dashboard.example.test',
    ]);
    expect(email.text).not.toContain('HST no.');
    expect(disclosed.text).toContain('HST no. 123456789RT0001<script>');
    expect(disclosed.html).toContain('HST no. 123456789RT0001&lt;script&gt;');
    expect(disclosed.html).not.toContain('<script>');
  });

  it('escapes receipt HTML while preserving plain text receipt details', () => {
    const email = renderReceipt('https://dashboard.example.test');
    expect(email.html).toContain('Buyer &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(email.html).toContain('Test &amp; Event');
    expect(email.html).not.toContain('<script>');
    expect(email.text).toContain(receipt.customerName);
  });

  it.each([
    'javascript:alert(1)',
    '//attacker.test',
    'not-a-url',
    '',
    'https://user:password@dashboard.example.test',
    'https://dashboard.example.test/?token=secret',
    'https://dashboard.example.test/#secret',
    'http://dashboard.example.test',
    'https://dashboard.example.test/\n',
  ])(
    'omits the link for invalid or unsafe configured base %j without losing the receipt',
    (base) => {
      const email = renderReceipt(base);
      expect(email.html).not.toContain('/wallet');
      expect(email.html).not.toContain('View your tickets');
      expect(email.html).toContain('href="mailto:info@tixmo.co"');
      expect(email.text).not.toContain('View your tickets:');
      expect(email.text).toContain('Total paid: CA$25.50 (includes HST and all fees)');
      expect(email.text).toContain('ORDER-123');
      expect(email.text).not.toContain('Your tickets will be available in your account shortly.');
    }
  );

  it.each(['http://localhost:5173', 'http://127.0.0.1:3001', 'http://[::1]:5173'])(
    'supports existing disposable-local dashboard configuration %s',
    (base) => {
      expect(renderReceipt(base).text).toContain(`${base}/wallet`);
    }
  );
});

describe('buyer receipt copy', () => {
  const render = (
    extra: Partial<Parameters<typeof orderConfirmationEmail>[0]> = {}
  ): ReturnType<typeof orderConfirmationEmail> =>
    orderConfirmationEmail({ ...receipt, ...extra }, 'https://dashboard.example.test');

  it('defaults the seller line to Tixmo Ltd. and escapes a configured legal name', () => {
    const unset = render();
    const blank = render({ sellerName: '   ' });
    const named = render({ sellerName: 'Acme <script> & "Co"' });
    const legacy = render({
      sellerName:
        'Tixmo Ltd., as ticketing agent for Quincy Enterprises Ltd. (Mighty Quinton Concerts), the event organizer',
      organizationName: 'Tixmo QA Staging',
    });
    const quincyOnly = render({
      sellerName: 'Quincy Enterprises Ltd. (Mighty Quinton Concerts)',
      organizationName: 'Tixmo QA Staging',
    });
    for (const email of [unset, blank]) {
      expect(email.html).toContain('Sold by Tixmo Ltd.');
      expect(email.text).toContain('Sold by Tixmo Ltd.');
      expect(email.html).not.toContain('Quincy');
      expect(email.text).not.toContain('as ticketing agent for');
    }
    expect(legacy.html).toContain('Sold by Tixmo Ltd., as ticketing agent for Tixmo QA Staging');
    expect(legacy.text).toContain('Sold by Tixmo Ltd., as ticketing agent for Tixmo QA Staging');
    expect(legacy.html).not.toContain('Quincy');
    expect(legacy.text).not.toContain('Mighty Quinton');
    expect(quincyOnly.html).toContain(
      'Sold by Tixmo Ltd., as ticketing agent for Tixmo QA Staging'
    );
    expect(quincyOnly.html).not.toContain('Quincy');
    expect(named.html).toContain('Sold by Acme &lt;script&gt; &amp; &quot;Co&quot;');
    expect(named.html).not.toContain('<script>');
    expect(named.text).toContain('Sold by Acme <script> & "Co"');
    expect(named.text).toContain('Includes HST (15%): CA$3.33');
    expect(named.text.indexOf('Includes HST (15%): CA$3.33')).toBeLessThan(
      named.text.indexOf('Sold by Acme <script> & "Co"')
    );
    expect(named.html.indexOf('Includes HST (15%): CA$3.33')).toBeLessThan(
      named.html.indexOf('Sold by')
    );
  });

  it('prints policy links only for valid https URLs', () => {
    const hidden = render();
    const rejected = render({
      refundPolicyUrl: 'http://policies.example.test/refunds',
      termsUrl: 'https://user:secret@policies.example.test/terms',
    });
    const refundOnly = render({ refundPolicyUrl: 'https://policies.example.test/refunds' });
    const both = render({
      refundPolicyUrl: '  https://policies.example.test/refunds  ',
      termsUrl: 'https://policies.example.test/terms',
    });
    for (const email of [hidden, rejected]) {
      expect(email.html).not.toContain('Refund policy');
      expect(email.html).not.toContain('Terms of Sale');
      expect(email.text).not.toContain('Refund policy:');
      expect(email.text).not.toContain('Terms of Sale:');
      expect(email.html).not.toContain('secret');
      expect(email.text).not.toContain('secret');
    }
    expect(refundOnly.html).toContain(
      '<a href="https://policies.example.test/refunds">Refund policy</a>'
    );
    expect(refundOnly.html).not.toContain('Terms of Sale');
    expect(refundOnly.text).toContain('Refund policy: https://policies.example.test/refunds');
    expect(refundOnly.text).not.toContain('Terms of Sale:');
    expect(both.html).toContain(
      '<a href="https://policies.example.test/refunds">Refund policy</a> · <a href="https://policies.example.test/terms">Terms of Sale</a>'
    );
    expect(both.text).toContain(
      'Refund policy: https://policies.example.test/refunds · Terms of Sale: https://policies.example.test/terms'
    );
    expect(both.html.indexOf('All sales are final')).toBeLessThan(
      both.html.indexOf('Refund policy')
    );
    expect(both.text.indexOf('All sales are final')).toBeLessThan(
      both.text.indexOf('Refund policy:')
    );
    const lines = both.text.split('\n').filter((line) => line.trim().length > 0);
    expect(lines.every((line) => /^ {6}\S/.test(line))).toBe(true);
  });

  it('falls back to info@tixmo.co when the support email is missing or invalid', () => {
    for (const supportEmail of [
      undefined,
      '',
      '   ',
      'not-an-email',
      'bad yosef.c@example.com',
      'a@b@c.com',
    ]) {
      const email = render({ supportEmail });
      expect(email.html).toContain('Questions? <a href="mailto:info@tixmo.co">info@tixmo.co</a>');
      expect(email.text).toContain('Questions? info@tixmo.co');
      expect(email.text).toContain('Contact info@tixmo.co.');
      expect(email.html).not.toContain('not-an-email');
    }
    const custom = render({ supportEmail: ' ops&crew@tixmo.co ' });
    expect(custom.html).toContain(
      'Questions? <a href="mailto:ops&amp;crew@tixmo.co">ops&amp;crew@tixmo.co</a>'
    );
    expect(custom.html).not.toContain('mailto:ops&crew@tixmo.co');
    expect(custom.text).toContain('Questions? ops&crew@tixmo.co');
    expect(custom.text).toContain('Contact ops&crew@tixmo.co.');
  });

  it('passes receipt copy from server config into the order confirmation', async () => {
    const receiptEnv = jest.requireMock<{
      config: {
        sellerName: string;
        supportEmail: string;
        refundPolicyUrl: string;
        termsUrl: string;
      };
    }>('../../src/config/environment');
    const service = new NotificationService();
    const send = jest.spyOn(service, 'sendEmail').mockResolvedValue(true);
    const original = { ...receiptEnv.config };
    try {
      await service.sendOrderConfirmation({ ...receipt, to: 'buyer@example.test' });
      expect(send.mock.calls[0][0].html).toContain('Sold by Tixmo Ltd.');
      expect(send.mock.calls[0][0].text).toContain('Sold by Tixmo Ltd.');
      expect(send.mock.calls[0][0].html).not.toContain('Quincy');

      receiptEnv.config.sellerName = 'Seller <b>';
      receiptEnv.config.supportEmail = 'not-an-email';
      receiptEnv.config.refundPolicyUrl = 'http://policies.example.test/refunds';
      receiptEnv.config.termsUrl = 'https://policies.example.test/terms';
      await service.sendOrderConfirmation({ ...receipt, to: 'buyer@example.test' });
      const sent = send.mock.calls[1][0];
      expect(sent.html).toContain('Sold by Seller &lt;b&gt;');
      expect(sent.html).not.toContain('Sold by Seller <b>');
      expect(sent.text).toContain('Sold by Seller <b>');
      expect(sent.html).not.toContain('http://policies.example.test/refunds');
      expect(sent.text).not.toContain('Refund policy:');
      expect(sent.html).toContain(
        '<a href="https://policies.example.test/terms">Terms of Sale</a>'
      );
      expect(sent.text).toContain('Terms of Sale: https://policies.example.test/terms');
      expect(sent.html).toContain('mailto:info@tixmo.co');
      expect(sent.text).toContain('Questions? info@tixmo.co');

      receiptEnv.config.sellerName =
        'Tixmo Ltd., as ticketing agent for Quincy Enterprises Ltd. (Mighty Quinton Concerts), the event organizer';
      await service.sendOrderConfirmation({
        ...receipt,
        to: 'buyer@example.test',
        organizationName: 'Tixmo QA Staging',
      });
      const staged = send.mock.calls[2][0];
      expect(staged.html).toContain('Sold by Tixmo Ltd., as ticketing agent for Tixmo QA Staging');
      expect(staged.text).toContain('Sold by Tixmo Ltd., as ticketing agent for Tixmo QA Staging');
      expect(staged.html).not.toContain('Quincy');
      expect(staged.text).not.toContain('Mighty Quinton');
    } finally {
      Object.assign(receiptEnv.config, original);
    }
  });
});
