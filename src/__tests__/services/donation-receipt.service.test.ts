import { generateReceiptPdf } from '@/services/donation-receipt.service';

describe('donation-receipt.service', () => {
  const mockOrg = {
    name: 'Test Nonprofit',
    ein: '12-3456789',
    addressLine1: '123 Main St',
    addressLine2: 'Suite 100',
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    country: 'US',
  };

  const mockDonation = {
    id: 'abc12345-6789-0000-0000-000000000000',
    amount: 250.00,
    donationDate: '2026-03-01T12:00:00Z',
    paymentMethod: 'STRIPE',
    isTaxDeductible: true,
    description: 'Annual fund contribution',
    campaignName: 'Spring Campaign',
  };

  const mockDonor = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    isAnonymous: false,
  };

  it('generates a valid PDF buffer', async () => {
    const pdf = await generateReceiptPdf(mockDonation, mockOrg, mockDonor);

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    // PDF files start with %PDF
    expect(pdf.toString('ascii', 0, 5)).toBe('%PDF-');
  });

  it('generates PDF for anonymous donor', async () => {
    const pdf = await generateReceiptPdf(
      mockDonation,
      mockOrg,
      { name: 'Jane Doe', isAnonymous: true },
    );

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('generates PDF without optional org fields', async () => {
    const minimalOrg = { name: 'Minimal Org' };
    const pdf = await generateReceiptPdf(mockDonation, minimalOrg, mockDonor);

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('generates PDF for non-tax-deductible donation', async () => {
    const pdf = await generateReceiptPdf(
      { ...mockDonation, isTaxDeductible: false },
      mockOrg,
      mockDonor,
    );

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('generates PDF without campaign or description', async () => {
    const pdf = await generateReceiptPdf(
      { ...mockDonation, campaignName: null, description: null },
      mockOrg,
      mockDonor,
    );

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('generates PDF with Date object for donationDate', async () => {
    const pdf = await generateReceiptPdf(
      { ...mockDonation, donationDate: new Date('2026-03-01') },
      mockOrg,
      mockDonor,
    );

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });
});
