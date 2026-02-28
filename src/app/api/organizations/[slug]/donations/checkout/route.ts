import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCurrentVersionWhere } from "@/lib/temporal/temporal-utils";
import { getStripe } from "@/lib/stripe";
import { getPaymentMethodByType } from "@/services/payment-method.service";
import { z } from "zod";

const checkoutSchema = z.object({
  amount: z.number().positive().min(5, "Minimum donation amount for card payments is $5"),
  campaignId: z.string().nullable().optional(),
  tierId: z.string().nullable().optional(),
  unitCount: z.number().int().positive().nullable().optional(),
  donorName: z.string().min(1).optional(),
  donorEmail: z.string().email().optional(),
  donorMessage: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  donationId: z.string().uuid().optional(),
});

function calculateTotalWithFees(donationAmount: number, feePercent: number, feeFixed: number): number {
  const rate = feePercent / 100;
  return Math.ceil(((donationAmount + feeFixed) / (1 - rate)) * 100) / 100;
}

/**
 * POST /api/organizations/[slug]/donations/checkout
 * Create a Stripe Checkout Session on the org's connected account.
 * No auth required — this is a public donor endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get Stripe payment method for this org
    const stripeMethod = await getPaymentMethodByType(
      organization.id,
      "STRIPE"
    );
    if (
      !stripeMethod?.stripeAccountId ||
      !stripeMethod.isEnabled ||
      !stripeMethod.stripeChargesEnabled
    ) {
      console.error("Stripe checkout blocked for org:", slug, {
        found: !!stripeMethod,
        stripeAccountId: !!stripeMethod?.stripeAccountId,
        isEnabled: stripeMethod?.isEnabled ?? null,
        stripeChargesEnabled: stripeMethod?.stripeChargesEnabled ?? null,
      });
      return NextResponse.json(
        { error: "Online payments are not available for this organization" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = checkoutSchema.parse(body);

    // Build line item description
    let description = `Donation to ${organization.name}`;
    if (validated.campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: validated.campaignId },
      });
      if (campaign) {
        description = `Donation to ${organization.name} — ${campaign.name}`;
      }
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // Always apply processing fees — org admin configures the rate
    const chargeAmount = calculateTotalWithFees(
      validated.amount,
      stripeMethod.stripeFeePercent,
      stripeMethod.stripeFeeFixed
    );

    // Create Checkout Session on the connected account
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: description,
                ...(validated.donorMessage
                  ? { description: validated.donorMessage }
                  : {}),
              },
              unit_amount: Math.round(chargeAmount * 100), // cents
            },
            quantity: 1,
          },
        ],
        ...(validated.donorEmail ? { customer_email: validated.donorEmail } : {}),
        metadata: {
          organizationId: organization.id,
          organizationSlug: slug,
          campaignId: validated.campaignId || "",
          tierId: validated.tierId || "",
          unitCount: String(validated.unitCount || ""),
          donorName: validated.donorName || "",
          donorMessage: validated.donorMessage || "",
          isAnonymous: String(validated.isAnonymous || false),
          donationAmount: String(validated.amount),
          donationId: validated.donationId || "",
        },
        success_url: `${baseUrl}/org/${slug}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: validated.campaignId
          ? `${baseUrl}/org/${slug}/donate/cancel?campaignId=${validated.campaignId}`
          : `${baseUrl}/org/${slug}/donate/cancel`,
      },
      {
        stripeAccount: stripeMethod.stripeAccountId,
      }
    );

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      console.error("Checkout validation failed:", messages);
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating checkout session:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
