import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { checkOrganizationAccess, VerificationStatusMessage } from "@/lib/organization-access";
import { OrganizationLayoutWrapper } from "@/components/navigation/OrganizationLayoutWrapper";
import { ProgramSpendingPageClient } from "@/components/program-spending/ProgramSpendingPageClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProgramSpendingPage({ params }: PageProps) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect("/login");
  }

  const { organization, userAccess } = await checkOrganizationAccess(
    slug,
    clerkUserId,
    false
  );

  if (!userAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const verificationMessage = VerificationStatusMessage({
    status: organization.verificationStatus,
    organizationName: organization.name,
    notes: organization.verificationNotes,
  });

  if (verificationMessage) {
    return verificationMessage;
  }

  const isAdmin = userAccess.role === "ORG_ADMIN" || userAccess.role === "PLATFORM_ADMIN";

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <ProgramSpendingPageClient
            organizationSlug={slug}
            canEdit={isAdmin}
          />
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
