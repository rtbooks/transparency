import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { buildCurrentVersionWhere, MAX_DATE } from "@/lib/temporal/temporal-utils";
import { updateAccountBalances } from "@/lib/accounting/balance-calculator";

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events (Connect account events).
 * Processes checkout.session.completed to auto-record donations.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature || !STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Missing signature or webhook secret" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          event.account || null
        );
        break;
      }
      case "account.updated": {
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      }
      default:
        // Unhandled event type — acknowledge receipt
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed — record the donation and create accounting entries.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  connectedAccountId: string | null
) {
  const metadata = session.metadata || {};
  const organizationId = metadata.organizationId;

  if (!organizationId) {
    console.error("Webhook: missing organizationId in session metadata");
    return;
  }

  // Prevent duplicate processing
  const existingTx = await prisma.transaction.findFirst({
    where: {
      stripeSessionId: session.id,
      validTo: MAX_DATE,
    },
  });
  if (existingTx) {
    console.log("Webhook: session already processed:", session.id);
    return;
  }

  const amount = (session.amount_total || 0) / 100;
  if (amount <= 0) return;

  // Get org's donation accounts
  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ id: organizationId }),
  });
  if (!organization) {
    console.error("Webhook: organization not found:", organizationId);
    return;
  }

  const cashAccountId = organization.donationsAccountId;
  const revenueAccountId = organization.donationsAccountId;

  if (!cashAccountId || !revenueAccountId) {
    console.error(
      "Webhook: organization missing donation account configuration:",
      organizationId
    );
    return;
  }

  // Find or create contact for donor
  const donorName = metadata.donorName || "Anonymous Donor";
  const donorEmail = session.customer_email || session.customer_details?.email;
  let contactId: string | null = null;

  if (donorEmail) {
    // Try to find existing contact by email
    const existingContact = await prisma.contact.findFirst({
      where: buildCurrentVersionWhere({
        organizationId,
        email: donorEmail,
      }),
    });
    if (existingContact) {
      contactId = existingContact.id;
    }
  }

  // If no contact found, create one
  if (!contactId) {
    const { createContact } = await import("@/services/contact.service");
    const contact = await createContact({
      organizationId,
      name: donorName,
      email: donorEmail || null,
      type: "INDIVIDUAL",
      roles: ["DONOR"],
    });
    contactId = contact.id;
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Create transaction: DR Cash, CR Revenue
    const transaction = await tx.transaction.create({
      data: {
        organizationId,
        transactionDate: now,
        amount,
        type: "INCOME",
        debitAccountId: cashAccountId,
        creditAccountId: revenueAccountId,
        description: `Online donation via Stripe — ${donorName}`,
        contactId,
        paymentMethod: "STRIPE",
        stripeSessionId: session.id,
        stripePaymentId: session.payment_intent as string || null,
        versionId: crypto.randomUUID(),
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
      },
    });

    // Update account balances
    await updateAccountBalances(tx, cashAccountId, revenueAccountId, amount);

    // Create donation record
    await tx.donation.create({
      data: {
        organizationId,
        contactId: contactId!,
        type: "ONE_TIME",
        status: "RECEIVED",
        amount,
        amountReceived: amount,
        description: metadata.donorMessage || null,
        donorMessage: metadata.donorMessage || null,
        isAnonymous: metadata.isAnonymous === "true",
        isTaxDeductible: true,
        donationDate: now,
        receivedDate: now,
        campaignId: metadata.campaignId || null,
        unitCount: metadata.unitCount ? parseInt(metadata.unitCount) : null,
        tierId: metadata.tierId || null,
        transactionId: transaction.id,
        billId: null,
        createdBy: null,
      },
    });
  });

  // Check campaign auto-complete
  if (metadata.campaignId) {
    const { checkAndAutoCompleteCampaign } = await import(
      "@/services/campaign.service"
    );
    await checkAndAutoCompleteCampaign(metadata.campaignId).catch(() => {});
  }

  console.log(
    `Webhook: recorded $${amount} donation for org ${organizationId} (session: ${session.id})`
  );
}

/**
 * Handle account.updated — sync connected account status.
 */
async function handleAccountUpdated(account: Stripe.Account) {
  if (!account.id) return;

  const { updateStripeConnectStatus } = await import(
    "@/services/payment-method.service"
  );

  // Find the org with this Stripe account
  const method = await prisma.organizationPaymentMethod.findFirst({
    where: { stripeAccountId: account.id },
  });

  if (method) {
    await updateStripeConnectStatus(
      method.organizationId,
      account.id,
      account.charges_enabled ?? false,
      account.payouts_enabled ?? false
    );
  }
}
