import { orderConfirmationEmail } from '../../src/utils/emailTemplates';
import { NotificationService } from '../../src/utils/notificationService';

jest.mock('../../src/config/environment', () => ({
  config: { clientUrl: 'https://configured-dashboard.example.test' },
}));
jest.mock('../../src/config/email', () => ({ transporter: {}, emailFrom: {} }));
jest.mock('../../src/config/logger', () => ({ logger: {} }));

const receipt = {
  customerName: 'Buyer <script>alert("x")</script>',
  orderNumber: 'ORDER-123',
  eventName: 'Test & Event',
  eventDate: '2026-11-09',
  ticketCount: 2,
  totalAmount: '25.50',
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
    expect(email.html).toContain('Total:</strong> $25.50');
    expect(email.text).toContain('Total: $25.50');
    expect(email.text).toContain('ORDER-123');
    expect(email.html).not.toMatch(/qrCode|resetToken|accessToken|password=/i);
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
      expect(email.html).not.toContain('href=');
      expect(email.text).not.toContain('View your tickets:');
      expect(email.text).toContain('Your tickets will be available in your account shortly.');
      expect(email.text).toContain('Total: $25.50');
    }
  );

  it.each(['http://localhost:5173', 'http://127.0.0.1:3001', 'http://[::1]:5173'])(
    'supports existing disposable-local dashboard configuration %s',
    (base) => {
      expect(renderReceipt(base).text).toContain(`${base}/wallet`);
    }
  );
});
