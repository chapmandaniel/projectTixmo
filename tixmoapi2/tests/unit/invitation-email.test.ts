import { userInvitationEmail } from '../../src/utils/emailTemplates';
import { STAFF_INVITATION_TTL_MS, staffInvitationTtlHours } from '../../src/utils/staffInvitation';

const inviteUrl = 'https://dashboard.example.test/invite#abc123';
const expiryNote = `This link expires in ${staffInvitationTtlHours()} hours. If it expires, ask your admin for a new invite.`;

describe('staff invitation email', () => {
  it('derives the displayed lifetime from the invitation expiry constant', () => {
    expect(STAFF_INVITATION_TTL_MS).toBe(48 * 60 * 60 * 1000);
    expect(staffInvitationTtlHours()).toBe(STAFF_INVITATION_TTL_MS / (60 * 60 * 1000));
    expect(staffInvitationTtlHours()).toBe(48);
  });

  it('asks the recipient to set a password and states the 48 hour expiry', () => {
    const email = userInvitationEmail({
      name: 'Riley <script>',
      email: 'riley@example.test',
      loginUrl: inviteUrl,
      setPassword: true,
    });

    expect(email.subject).toBe('You have been invited to Tixmo');
    expect(email.html).toContain('>Set your password</a>');
    expect(email.html).toContain(`href="${inviteUrl}"`);
    expect(email.html).toContain(expiryNote);
    expect(email.html).toContain('Riley &lt;script&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toMatch(/Log [Ii]n/);
    expect(email.html).not.toContain('Temporary Password');
    expect(email.html).not.toContain('TixMo');
    expect(email.text).toContain(`Username: riley@example.test\n\nSet your password: ${inviteUrl}`);
    expect(email.text).toContain(expiryNote);
    expect(email.text).toContain('Riley <script>');
    expect(email.text).not.toMatch(/Log in here/);
    expect(email.text).not.toContain('Temporary Password');
    expect(email.text).not.toContain('TixMo');
    expect(email.text).not.toMatch(/\n\n\n/);
    expect(email.html).not.toMatch(/<p>\s*<\/p>/);
  });

  it('keeps a login call to action when the account already has a password', () => {
    const email = userInvitationEmail({
      name: 'Riley',
      email: 'riley@example.test',
      loginUrl: 'https://dashboard.example.test/login',
    });

    expect(email.html).toContain('>Log In to Tixmo</a>');
    expect(email.html).not.toContain('Set your password');
    expect(email.html).not.toContain('expires in');
    expect(email.text).toContain(
      'Username: riley@example.test\n\nLog in here: https://dashboard.example.test/login'
    );
    expect(email.text).not.toContain('Set your password');
    expect(email.text).not.toContain('expires in');
    expect(email.text).not.toMatch(/\n\n\n/);
    expect(email.text).not.toContain('Temporary Password');
  });
});
