import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { checkOrganizationAccess, VerificationStatusMessage } from '@/lib/organization-access';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { DonationsPageClient } from '@/components/org/DonationsPageClient';

interface DonationsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ stripe?: string }>;
}

export const metadata: Metadata = { title: "My Donations" };

export default async function DonationsPage({ params, searchParams }: DonationsPageProps) {
  const { slug } = await params;
  const { stripe } = await searchParams;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  const { organization } = await checkOrganizationAccess(slug, clerkUserId, false);

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
      <DonationsPageClient
        organizationSlug={slug}
        organizationName={organization.name}
        stripeSuccess={stripe === 'success'}
      />
    </OrganizationLayoutWrapper>
  );
}
