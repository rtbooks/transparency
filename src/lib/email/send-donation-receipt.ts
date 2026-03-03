import { sendEmail } from '@/lib/email/resend';
import { DonationReceiptEmail } from '@/lib/email/templates/donation-receipt-email';
import {
  generateReceiptPdf,
  ReceiptOrganization,
  ReceiptDonation,
  ReceiptDonor,
} from '@/services/donation-receipt.service';

interface SendDonationReceiptParams {
  donorEmail: string;
  donor: ReceiptDonor;
  donation: ReceiptDonation;
  organization: ReceiptOrganization;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatPaymentMethod(method?: string | null): string | undefined {
  if (!method) return undefined;
  return method.charAt(0) + method.slice(1).toLowerCase().replace(/_/g, ' ');
}

/**
 * Send a donation receipt email with PDF attachment. Fire-and-forget — never throws.
 */
export async function sendDonationReceiptEmail(params: SendDonationReceiptParams): Promise<boolean> {
  const { donorEmail, donor, donation, organization } = params;

  try {
    const pdfBuffer = await generateReceiptPdf(donation, organization, donor);

    const donorName = donor.isAnonymous ? 'Anonymous Donor' : donor.name;
    const receiptId = donation.id.substring(0, 8).toUpperCase();

    return await sendEmail({
      to: donorEmail,
      subject: `Donation Receipt from ${organization.name} — ${formatCurrency(donation.amount)}`,
      react: DonationReceiptEmail({
        donorName,
        organizationName: organization.name,
        amount: formatCurrency(donation.amount),
        donationDate: formatDate(donation.donationDate),
        paymentMethod: formatPaymentMethod(donation.paymentMethod),
        campaignName: donation.campaignName ?? undefined,
        isTaxDeductible: donation.isTaxDeductible,
        ein: organization.ein ?? undefined,
      }),
      attachments: [
        {
          filename: `donation-receipt-${receiptId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (error) {
    console.error('[Email] Failed to send donation receipt:', error);
    return false;
  }
}
