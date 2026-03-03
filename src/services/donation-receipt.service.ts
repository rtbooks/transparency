import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ReceiptOrganization {
  name: string;
  ein?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface ReceiptDonation {
  id: string;
  amount: number;
  donationDate: string | Date;
  paymentMethod?: string | null;
  isTaxDeductible: boolean;
  description?: string | null;
  campaignName?: string | null;
}

export interface ReceiptDonor {
  name: string;
  email?: string | null;
  isAnonymous?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatOrgAddress(org: ReceiptOrganization): string[] {
  const lines: string[] = [];
  if (org.addressLine1) lines.push(org.addressLine1);
  if (org.addressLine2) lines.push(org.addressLine2);
  const cityStateZip = [
    org.city,
    org.state ? (org.city ? `, ${org.state}` : org.state) : null,
    org.postalCode ? ` ${org.postalCode}` : null,
  ].filter(Boolean).join('');
  if (cityStateZip) lines.push(cityStateZip);
  return lines;
}

/**
 * Generate a PDF tax receipt for a donation payment.
 * Returns the PDF as a Buffer.
 */
export async function generateReceiptPdf(
  donation: ReceiptDonation,
  organization: ReceiptOrganization,
  donor: ReceiptDonor,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter size
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const darkGray = rgb(0.2, 0.2, 0.2);
  const lineColor = rgb(0.85, 0.85, 0.85);

  const leftMargin = 60;
  const rightMargin = 552;
  let y = 720;

  // Header - Organization name
  page.drawText(organization.name, {
    x: leftMargin,
    y,
    size: 22,
    font: helveticaBold,
    color: darkGray,
  });
  y -= 24;

  // Organization address
  const addressLines = formatOrgAddress(organization);
  for (const line of addressLines) {
    page.drawText(line, { x: leftMargin, y, size: 10, font: helvetica, color: gray });
    y -= 14;
  }

  // EIN
  if (organization.ein) {
    page.drawText(`EIN: ${organization.ein}`, { x: leftMargin, y, size: 10, font: helvetica, color: gray });
    y -= 14;
  }

  y -= 10;

  // Horizontal line
  page.drawLine({
    start: { x: leftMargin, y },
    end: { x: rightMargin, y },
    thickness: 1,
    color: lineColor,
  });
  y -= 30;

  // Title
  page.drawText('Donation Receipt', {
    x: leftMargin,
    y,
    size: 18,
    font: helveticaBold,
    color: black,
  });
  y -= 14;

  // Receipt number
  page.drawText(`Receipt #${donation.id.substring(0, 8).toUpperCase()}`, {
    x: leftMargin,
    y,
    size: 10,
    font: helvetica,
    color: gray,
  });
  y -= 30;

  // Donor info
  const drawField = (label: string, value: string) => {
    page.drawText(label, { x: leftMargin, y, size: 10, font: helveticaBold, color: darkGray });
    page.drawText(value, { x: leftMargin + 140, y, size: 10, font: helvetica, color: black });
    y -= 18;
  };

  const donorName = donor.isAnonymous ? 'Anonymous Donor' : donor.name;
  drawField('Donor:', donorName);
  drawField('Date:', formatDate(donation.donationDate));
  drawField('Amount:', formatCurrency(donation.amount));

  if (donation.paymentMethod) {
    const methodLabel = donation.paymentMethod.charAt(0) + donation.paymentMethod.slice(1).toLowerCase().replace(/_/g, ' ');
    drawField('Payment Method:', methodLabel);
  }

  if (donation.campaignName) {
    drawField('Campaign:', donation.campaignName);
  }

  if (donation.description) {
    drawField('Description:', donation.description);
  }

  y -= 20;

  // Horizontal line
  page.drawLine({
    start: { x: leftMargin, y },
    end: { x: rightMargin, y },
    thickness: 1,
    color: lineColor,
  });
  y -= 25;

  // Tax deductibility statement
  if (donation.isTaxDeductible) {
    const taxLines = [
      'This letter serves as your official receipt for tax purposes.',
      `${organization.name} is a 501(c)(3) tax-exempt organization.`,
      'No goods or services were provided in exchange for this contribution.',
      'Please retain this receipt for your tax records.',
    ];
    for (const line of taxLines) {
      page.drawText(line, { x: leftMargin, y, size: 9, font: helvetica, color: darkGray });
      y -= 14;
    }
  } else {
    page.drawText('This donation may not be tax-deductible. Please consult your tax advisor.',
      { x: leftMargin, y, size: 9, font: helvetica, color: darkGray });
    y -= 14;
  }

  y -= 30;

  // Thank you
  page.drawText('Thank you for your generous contribution!', {
    x: leftMargin,
    y,
    size: 12,
    font: helveticaBold,
    color: darkGray,
  });

  // Footer
  page.drawText(`Generated by RadBooks on ${formatDate(new Date())}`, {
    x: leftMargin,
    y: 40,
    size: 8,
    font: helvetica,
    color: gray,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
