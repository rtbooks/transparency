import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { generateReceiptPdf } from '@/services/donation-receipt.service';

/**
 * GET /api/organizations/[slug]/donations/[id]/receipt
 * Generate and download a PDF tax receipt for a donation.
 * Any org member can download receipts for their own donations; admins can download any.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug);

    const donation = await prisma.donation.findFirst({
      where: { id, organizationId: ctx.orgId },
    });

    if (!donation) {
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
    }

    // Non-admin users can only download their own receipts
    if (ctx.role !== 'ORG_ADMIN' && !ctx.isPlatformAdmin) {
      const contact = await prisma.contact.findFirst({
        where: buildCurrentVersionWhere({ id: donation.contactId, userId: ctx.userId }),
      });
      if (!contact) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Only generate receipts for donations that have received payment
    if (donation.status === 'PLEDGED' || donation.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Receipt is only available for donations with recorded payments' },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ id: ctx.orgId }),
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const contact = await prisma.contact.findFirst({
      where: buildCurrentVersionWhere({ id: donation.contactId }),
    });

    const pdfBuffer = await generateReceiptPdf(
      {
        id: donation.id,
        amount: Number(donation.amount),
        donationDate: donation.donationDate,
        paymentMethod: donation.paymentMethod,
        isTaxDeductible: donation.isTaxDeductible,
        description: donation.description,
        campaignName: null,
      },
      {
        name: organization.name,
        ein: organization.ein,
        addressLine1: organization.addressLine1,
        addressLine2: organization.addressLine2,
        city: organization.city,
        state: organization.state,
        postalCode: organization.postalCode,
        country: organization.country,
      },
      {
        name: contact?.name || 'Donor',
        isAnonymous: donation.isAnonymous,
      },
    );

    const receiptId = donation.id.substring(0, 8).toUpperCase();

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="donation-receipt-${receiptId}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error generating donation receipt:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
