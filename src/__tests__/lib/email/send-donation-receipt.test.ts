import { sendDonationReceiptEmail } from '@/lib/email/send-donation-receipt';

// Mock the email sender and PDF generator
jest.mock('@/lib/email/resend', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/services/donation-receipt.service', () => ({
  generateReceiptPdf: jest.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
}));

const { sendEmail } = jest.requireMock('@/lib/email/resend');
const { generateReceiptPdf } = jest.requireMock('@/services/donation-receipt.service');

describe('send-donation-receipt', () => {
  const params = {
    donorEmail: 'jane@example.com',
    donor: { name: 'Jane Doe', isAnonymous: false },
    donation: {
      id: 'abc12345-6789-0000-0000-000000000000',
      amount: 100,
      donationDate: '2026-03-01',
      paymentMethod: 'STRIPE',
      isTaxDeductible: true,
      description: null,
      campaignName: 'Spring Fund',
    },
    organization: {
      name: 'Test Nonprofit',
      ein: '12-3456789',
      addressLine1: '123 Main St',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends email with PDF attachment', async () => {
    const result = await sendDonationReceiptEmail(params);

    expect(result).toBe(true);
    expect(generateReceiptPdf).toHaveBeenCalledWith(
      params.donation,
      params.organization,
      params.donor,
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: expect.stringContaining('Test Nonprofit'),
        attachments: [
          expect.objectContaining({
            filename: expect.stringMatching(/^donation-receipt-.*\.pdf$/),
            contentType: 'application/pdf',
          }),
        ],
      }),
    );
  });

  it('uses Anonymous Donor name when isAnonymous', async () => {
    await sendDonationReceiptEmail({
      ...params,
      donor: { name: 'Jane Doe', isAnonymous: true },
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('$100.00'),
      }),
    );
  });

  it('returns false on PDF generation error', async () => {
    generateReceiptPdf.mockRejectedValueOnce(new Error('PDF error'));

    const result = await sendDonationReceiptEmail(params);

    expect(result).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns false on email send error', async () => {
    sendEmail.mockResolvedValueOnce(false);

    const result = await sendDonationReceiptEmail(params);

    expect(result).toBe(false);
  });
});
