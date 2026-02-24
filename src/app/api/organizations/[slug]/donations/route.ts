import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, buildEntitiesWhere, buildEntityMap } from '@/lib/temporal/temporal-utils';

/**
 * GET /api/organizations/[slug]/donations
 * Returns the authenticated donor's pledges and payments for this organization.
 * Also accessible by ORG_ADMIN/PLATFORM_ADMIN to see all donations.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];

    if (!orgUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const isAdmin = user.isPlatformAdmin || orgUser.role === 'ORG_ADMIN';

    // Find the donor's contact record(s) in this organization
    const donorContacts = await prisma.contact.findMany({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        userId: user.id,
      }),
    });

    const contactIds = donorContacts.map(c => c.id);

    // For admins, show all donor-role contacts' pledges PLUS their own
    let donorContactIds = contactIds;
    if (isAdmin) {
      const allDonorContacts = await prisma.contact.findMany({
        where: buildCurrentVersionWhere({
          organizationId: organization.id,
          roles: { has: 'DONOR' },
        }),
        select: { id: true },
      });
      // Merge admin's own contact IDs with all donor contact IDs
      const allIds = new Set([...contactIds, ...allDonorContacts.map(c => c.id)]);
      donorContactIds = [...allIds];
    }

    // Build bill filter: only RECEIVABLE bills from relevant contacts
    const billWhere: any = {
      organizationId: organization.id,
      direction: 'RECEIVABLE',
    };

    if (!isAdmin && contactIds.length > 0) {
      billWhere.contactId = { in: contactIds };
    } else if (!isAdmin) {
      // Donor with no linked contact — return empty
      return NextResponse.json({
        pledges: [],
        summary: { totalPledged: 0, totalPaid: 0, outstanding: 0 },
        paymentInstructions: organization.paymentInstructions,
      });
    } else if (donorContactIds.length > 0) {
      billWhere.contactId = { in: donorContactIds };
    } else {
      // No donor contacts exist at all
      billWhere.contactId = { in: [] };
    }

    const pledges = await prisma.bill.findMany({
      where: billWhere,
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve contact names
    const allContactIds = [...new Set(pledges.map(p => p.contactId))];
    const contacts = allContactIds.length > 0
      ? await prisma.contact.findMany({ where: buildEntitiesWhere(allContactIds) })
      : [];
    const contactMap = buildEntityMap(contacts);

    // Resolve payment transactions
    const txIds = pledges.flatMap(p => p.payments.map(pay => pay.transactionId));
    const uniqueTxIds = [...new Set(txIds)];
    const transactions = uniqueTxIds.length > 0
      ? await prisma.transaction.findMany({ where: buildEntitiesWhere(uniqueTxIds) })
      : [];
    const txMap = buildEntityMap(transactions);

    // Resolve campaign attribution via accrual transactions
    const accrualTxIds = pledges.map(p => p.accrualTransactionId).filter(Boolean) as string[];
    const accrualTransactions = accrualTxIds.length > 0
      ? await prisma.transaction.findMany({ where: buildEntitiesWhere(accrualTxIds) })
      : [];
    const accrualTxMap = buildEntityMap(accrualTransactions);

    // Load all campaigns for this org to map accountId → campaign name
    const allCampaigns = await prisma.campaign.findMany({
      where: { organizationId: organization.id },
    });
    const campaignByAccountId = new Map(allCampaigns.map(c => [c.accountId, c]));

    const enrichedPledges = pledges.map(pledge => {
      const contact = contactMap.get(pledge.contactId);
      // Find campaign via accrual transaction's credit account
      let campaignName: string | null = null;
      let campaignId: string | null = null;
      if (pledge.accrualTransactionId) {
        const accrualTx = accrualTxMap.get(pledge.accrualTransactionId);
        if (accrualTx) {
          const campaign = campaignByAccountId.get(accrualTx.creditAccountId);
          if (campaign) {
            campaignName = campaign.name;
            campaignId = campaign.id;
          }
        }
      }
      return {
        ...pledge,
        contactName: contact?.name ?? 'Unknown',
        amount: Number(pledge.amount),
        amountPaid: Number(pledge.amountPaid),
        campaignName,
        campaignId,
        payments: pledge.payments.map(pay => {
          const tx = txMap.get(pay.transactionId);
          return {
            ...pay,
            amount: tx ? Number(tx.amount) : 0,
            date: tx?.transactionDate ?? pay.createdAt,
          };
        }),
      };
    });

    const totalPledged = enrichedPledges.reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = enrichedPledges.reduce((sum, p) => sum + p.amountPaid, 0);

    return NextResponse.json({
      pledges: enrichedPledges,
      summary: {
        totalPledged,
        totalPaid,
        outstanding: totalPledged - totalPaid,
      },
      paymentInstructions: organization.paymentInstructions,
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
