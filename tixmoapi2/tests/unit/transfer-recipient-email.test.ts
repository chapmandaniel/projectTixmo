import { transferTicketSchema } from '../../src/api/tickets/validation';

describe('transferTicketSchema recipientEmail', () => {
  it("normalises ' Bob@X.com' at the validation boundary", () => {
    const parsed = transferTicketSchema.parse({
      body: { recipientEmail: ' Bob@X.com' },
    });
    expect(parsed.body.recipientEmail).toBe('bob@x.com');
  });
});
