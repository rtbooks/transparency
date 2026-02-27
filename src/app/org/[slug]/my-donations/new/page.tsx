import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { checkOrganizationAccess, VerificationStatusMessage } from '@/lib/organization-access';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { NewPledgeFormClient } from '@/components/org/NewPledgeFormClient';

interface NewPledgePageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Record Donation" };

export default async function NewPledgePage({ params }: NewPledgePageProps) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  const { organization, userAccess, user } = await checkOrganizationAccess(slug, clerkUserId, false);

  if (!userAccess && !user.isPlatformAdmin) {
    return (
      <OrganizationLayoutWrapper organizationSlug={slug}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">
              You need to be a member of this organization to create a pledge.
            </p>
          </div>
        </div>
      </OrganizationLayoutWrapper>
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

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <NewPledgeFormClient
        organizationSlug={slug}
        organizationName={organization.name}
        paymentInstructions={organization.paymentInstructions}
      />
    </OrganizationLayoutWrapper>
  );
}
