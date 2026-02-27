import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { updateStripeConnectStatus } from "@/services/payment-method.service";

/**
 * GET /api/stripe/callback
 * Handle Stripe Connect OAuth callback.
 * Stripe redirects here after org admin authorizes.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Parse state to get org info
    const [organizationId, slug] = (state || "").split(":");
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const settingsUrl = `${baseUrl}/org/${slug}/settings`;

    if (error) {
      console.error("Stripe Connect OAuth error:", error, errorDescription);
      const redirectUrl = new URL(settingsUrl);
      redirectUrl.searchParams.set("stripe_error", errorDescription || error);
      return NextResponse.redirect(redirectUrl.toString());
    }

    if (!code || !organizationId || !slug) {
      return NextResponse.redirect(
        `${settingsUrl}?stripe_error=Invalid callback parameters`
      );
    }

    // Exchange authorization code for connected account
    const response = await getStripe().oauth.token({
      grant_type: "authorization_code",
      code,
    });

    if (!response.stripe_user_id) {
      return NextResponse.redirect(
        `${settingsUrl}?stripe_error=Failed to connect Stripe account`
      );
    }

    // Check account capabilities
    const account = await getStripe().accounts.retrieve(response.stripe_user_id);

    // Save connected account info
    await updateStripeConnectStatus(
      organizationId,
      response.stripe_user_id,
      account.charges_enabled ?? false,
      account.payouts_enabled ?? false
    );

    // Redirect back to org settings with success
    const redirectUrl = new URL(settingsUrl);
    redirectUrl.searchParams.set("stripe_connected", "true");
    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("Error handling Stripe callback:", error);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.redirect(
      `${baseUrl}/?stripe_error=Connection failed`
    );
  }
}
