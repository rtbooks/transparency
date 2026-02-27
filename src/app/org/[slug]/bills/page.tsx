import type { Metadata } from 'next';
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildCurrentVersionWhere } from "@/lib/temporal/temporal-utils";
import { BillsPageClient } from "@/components/bills/BillsPageClient";
import { OrganizationLayoutWrapper } from "@/components/navigation/OrganizationLayoutWrapper";
import { checkOrganizationAccess, VerificationStatusMessage } from "@/lib/organization-access";

interface BillsPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Bills" };

export default async function BillsPage({ params }: BillsPageProps) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect("/login");
  }

  const { organization, userAccess, user } = await checkOrganizationAccess(
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

  const canEdit = userAccess.role === "ORG_ADMIN" || user.isPlatformAdmin;

  const verificationMessage = VerificationStatusMessage({
    status: organization.verificationStatus,
    organizationName: organization.name,
    notes: organization.verificationNotes,
  });

  if (verificationMessage) {
    return verificationMessage;
  }

  // Fetch active accounts for bill form account selectors
  const accounts = await prisma.account.findMany({
    where: buildCurrentVersionWhere({
      organizationId: organization.id,
      isActive: true,
    }),
    select: { id: true, code: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <BillsPageClient organizationSlug={slug} accounts={accounts} canEdit={canEdit} />
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
