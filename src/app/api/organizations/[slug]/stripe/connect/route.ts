import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { buildCurrentVersionWhere } from "@/lib/temporal/temporal-utils";
import { getStripe, STRIPE_CLIENT_ID } from "@/lib/stripe";
import {
  updateStripeConnectStatus,
  disconnectStripe,
  getPaymentMethodByType,
} from "@/services/payment-method.service";

/**
 * GET /api/organizations/[slug]/stripe/connect
 * Initiate Stripe Connect OAuth flow. Redirects admin to Stripe.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!STRIPE_CLIENT_ID) {
      return NextResponse.json(
        { error: "Stripe Connect is not configured" },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check admin role
    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        userId: user.id,
        organizationId: organization.id,
      }),
    });
    if (orgUser?.role !== "ORG_ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build Stripe Connect OAuth URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const state = `${organization.id}:${slug}`;
    const connectUrl = new URL("https://connect.stripe.com/oauth/authorize");
    connectUrl.searchParams.set("response_type", "code");
    connectUrl.searchParams.set("client_id", STRIPE_CLIENT_ID);
    connectUrl.searchParams.set("scope", "read_write");
    connectUrl.searchParams.set("state", state);
    connectUrl.searchParams.set(
      "redirect_uri",
      `${baseUrl}/api/stripe/callback`
    );
    // Pre-fill org info
    if (organization.name) {
      connectUrl.searchParams.set(
        "stripe_user[business_name]",
        organization.name
      );
    }
    if (organization.ein) {
      connectUrl.searchParams.set(
        "stripe_user[business_type]",
        "non_profit"
      );
    }

    return NextResponse.redirect(connectUrl.toString());
  } catch (error) {
    console.error("Error initiating Stripe Connect:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[slug]/stripe/connect
 * Manage Stripe connection: disconnect or check status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        userId: user.id,
        organizationId: organization.id,
      }),
    });
    if (orgUser?.role !== "ORG_ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    if (body.action === "disconnect") {
      const method = await getPaymentMethodByType(organization.id, "STRIPE");
      if (method?.stripeAccountId) {
        try {
          await getStripe().oauth.deauthorize({
            client_id: STRIPE_CLIENT_ID!,
            stripe_user_id: method.stripeAccountId,
          });
        } catch {
          // Account may already be disconnected on Stripe's side
        }
      }
      await disconnectStripe(organization.id);
      return NextResponse.json({ success: true });
    }

    if (body.action === "status") {
      const method = await getPaymentMethodByType(organization.id, "STRIPE");
      if (!method?.stripeAccountId) {
        return NextResponse.json({ connected: false });
      }
      try {
        const account = await getStripe().accounts.retrieve(
          method.stripeAccountId
        );
        await updateStripeConnectStatus(
          organization.id,
          method.stripeAccountId,
          account.charges_enabled ?? false,
          account.payouts_enabled ?? false
        );
        return NextResponse.json({
          connected: true,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          accountId: method.stripeAccountId,
        });
      } catch {
        return NextResponse.json({ connected: false });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error managing Stripe Connect:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
