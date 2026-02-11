import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyEIN } from "@/lib/verification/propublica";

/**
 * POST /api/organizations/verify-ein
 * 
 * Verify an EIN with ProPublica API
 * Used during organization creation to validate 501(c)(3) status
 */
export async function POST(request: Request) {
  try {
    // Require authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ein } = body;

    if (!ein) {
      return NextResponse.json(
        { error: "EIN is required" },
        { status: 400 }
      );
    }

    // Verify EIN with ProPublica
    const result = await verifyEIN(ein);

    return NextResponse.json(result);
  } catch (error) {
    console.error("EIN verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify EIN" },
      { status: 500 }
    );
  }
}
