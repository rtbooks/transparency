/**
 * Audit Trail Page
 * Complete change log for an organization
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { OrganizationService } from '@/services/organization.service';
import { AccountService } from '@/services/account.service';
import { AuditTrailClient } from './AuditTrailClient';

interface AuditTrailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function AuditTrailPage({ params }: AuditTrailPageProps) {
  const { slug } = await params;
  const organization = await OrganizationService.findBySlug(slug);

  if (!organization) {
    notFound();
  }

  // Fetch history for organization
  const orgHistory = await OrganizationService.findHistory(slug);
  const accountsHistory = await AccountService.findChangesInRange(
    organization.id,
    new Date('2020-01-01'), // Far back start date
    new Date() // Current date
  );

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Audit Trail</h1>
        <p className="text-muted-foreground">
          Complete change history for {organization.name}
        </p>
      </div>

      <Suspense fallback={<div>Loading audit trail...</div>}>
        <AuditTrailClient
          organization={organization}
          orgHistory={orgHistory}
          accountsHistory={accountsHistory}
        />
      </Suspense>
    </div>
  );
}

export const metadata: Metadata = {
  title: 'Audit Trail',
  description: 'View complete change history',
};
