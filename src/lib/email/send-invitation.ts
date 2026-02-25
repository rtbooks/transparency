import { sendEmail } from '@/lib/email/resend';
import { InvitationEmail } from '@/lib/email/templates/invitation-email';

interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
  expiresInDays?: number;
  organizationLogoUrl?: string;
}

/**
 * Send an invitation email. Fire-and-forget — never throws.
 */
export async function sendInvitationEmail(params: SendInvitationEmailParams): Promise<boolean> {
  const { to, inviterName, organizationName, role, inviteUrl, expiresInDays = 7, organizationLogoUrl } = params;

  return sendEmail({
    to,
    subject: `${inviterName} invited you to ${organizationName} on RadBooks`,
    react: InvitationEmail({ inviterName, organizationName, role, inviteUrl, expiresInDays, organizationLogoUrl }),
  });
}
