import { sendEmail } from '@/lib/email/resend';
import { CampaignInviteEmail } from '@/lib/email/templates/campaign-invite-email';

interface SendCampaignInviteParams {
  to: string;
  senderName: string;
  organizationName: string;
  campaignName: string;
  campaignDescription: string | null;
  personalMessage?: string;
  donateUrl: string;
  organizationLogoUrl?: string;
}

/**
 * Send a campaign invite email. Fire-and-forget — never throws.
 */
export async function sendCampaignInviteEmail(params: SendCampaignInviteParams): Promise<boolean> {
  const { to, senderName, organizationName, campaignName, campaignDescription, personalMessage, donateUrl, organizationLogoUrl } = params;

  return sendEmail({
    to,
    subject: `${senderName} invited you to donate to "${campaignName}" — ${organizationName}`,
    react: CampaignInviteEmail({
      senderName,
      organizationName,
      campaignName,
      campaignDescription,
      personalMessage: personalMessage || null,
      donateUrl,
      organizationLogoUrl,
    }),
  });
}
