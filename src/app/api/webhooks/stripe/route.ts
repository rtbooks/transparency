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
 * Handle checkout.session.completed — either pay an existing pledge or create a new donation.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  connectedAccountId: string | null
) {
  const metadata = session.metadata || {};
  const organizationId = metadata.organizationId;

  console.log("Webhook: session metadata:", JSON.stringify(metadata));

  if (!organizationId) {
    console.error("Webhook: missing organizationId in session metadata");
    return;
  }

  // Prevent duplicate processing — check both stripeSessionId and referenceNumber
  const existingTx = await prisma.transaction.findFirst({
    where: {
      OR: [
        { stripeSessionId: session.id },
        ...(session.payment_intent
          ? [{ referenceNumber: session.payment_intent as string, paymentMethod: "STRIPE" as const }]
          : []),
      ],
      validTo: MAX_DATE,
    },
  });
  if (existingTx) {
    console.log("Webhook: session already processed:", session.id);
    return;
  }

  const donationAmount = metadata.donationAmount
    ? parseFloat(metadata.donationAmount)
    : 0;
  const chargedAmount = (session.amount_total || 0) / 100;
  const amount = donationAmount > 0 ? donationAmount : chargedAmount;
  if (amount <= 0) return;

  // Get org's donation accounts
  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ id: organizationId }),
  });
  if (!organization) {
    console.error("Webhook: organization not found:", organizationId);
    return;
  }

  // Look up the Stripe payment method to get the linked clearing account
  const stripeMethod = await prisma.organizationPaymentMethod.findFirst({
    where: {
      organizationId,
      type: "STRIPE",
      ...(connectedAccountId ? { stripeAccountId: connectedAccountId } : {}),
    },
  });

  const clearingAccountId = stripeMethod?.accountId;

  if (!clearingAccountId) {
    console.error(
      "Webhook: organization missing Stripe clearing account",
      organizationId
    );
    return;
  }

  // Branch: paying an existing pledge vs. new donation
  if (metadata.donationId) {
    await handlePledgePayment(
      session, metadata, organizationId, clearingAccountId, amount, chargedAmount
    );
  } else {
    const revenueAccountId = organization.donationsAccountId;
    if (!revenueAccountId) {
      console.error(
        "Webhook: organization missing donations revenue account",
        organizationId
      );
      return;
    }
    await handleNewDonation(
      session, metadata, organizationId, clearingAccountId, revenueAccountId, amount, chargedAmount
    );
  }

  // Check campaign auto-complete
  if (metadata.campaignId) {
    const { checkAndAutoCompleteCampaign } = await import(
      "@/services/campaign.service"
    );
    await checkAndAutoCompleteCampaign(metadata.campaignId).catch(() => {});
  }
}

/**
 * Pay an existing pledge donation via Stripe.
 * Creates a transaction DR Stripe Clearing, CR AR (from the pledge's accrual),
 * records the bill payment, and updates donation status.
 */
async function handlePledgePayment(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  organizationId: string,
  clearingAccountId: string,
  amount: number,
  chargedAmount: number,
) {
  const donation = await prisma.donation.findFirst({
    where: { id: metadata.donationId, organizationId },
  });

  if (!donation) {
    console.error("Webhook: pledge donation not found:", metadata.donationId);
    return;
  }

  if (!donation.billId) {
    console.error("Webhook: pledge donation has no linked bill:", metadata.donationId);
    return;
  }

  const { recordPayment } = await import("@/services/bill-payment.service");
  const { recalculateBillStatus } = await import("@/services/bill.service");
  const { recordDonationPayment } = await import("@/services/donation.service");

  // recordPayment creates the transaction (DR Stripe Clearing, CR AR) and BillPayment
  const billPayment = await recordPayment({
    billId: donation.billId,
    organizationId,
    amount,
    transactionDate: new Date(),
    cashAccountId: clearingAccountId,
    description: `Stripe payment for pledge — ${metadata.donorName || 'Donor'}`,
    referenceNumber: session.payment_intent as string || null,
    paymentMethod: "STRIPE",
  });

  // Mark the transaction with Stripe session/payment IDs for dedup (best-effort)
  await prisma.transaction.updateMany({
    where: { id: billPayment.transactionId },
    data: {
      stripeSessionId: session.id,
      stripePaymentId: session.payment_intent as string || null,
    },
  }).catch((err) => console.error("Webhook: failed to set Stripe IDs on transaction:", err));

  // Update bill and donation status — these must both run
  await recalculateBillStatus(donation.billId);
  await recordDonationPayment(donation.id, organizationId, amount);

  console.log(
    `Webhook: recorded $${amount} pledge payment for donation ${donation.id} (session: ${session.id})`
  );
}

/**
 * Create a new one-time donation from a Stripe checkout (no pre-existing pledge).
 */
async function handleNewDonation(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  organizationId: string,
  clearingAccountId: string,
  revenueAccountId: string,
  amount: number,
  chargedAmount: number,
) {
  const donorName = metadata.donorName || "Anonymous Donor";
  const donorEmail = session.customer_email || session.customer_details?.email;
  let contactId: string | null = null;

  if (donorEmail) {
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
    const transaction = await tx.transaction.create({
      data: {
        organizationId,
        transactionDate: now,
        amount: chargedAmount,
        type: "INCOME",
        debitAccountId: clearingAccountId,
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

    await updateAccountBalances(tx, clearingAccountId, revenueAccountId, chargedAmount);

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
