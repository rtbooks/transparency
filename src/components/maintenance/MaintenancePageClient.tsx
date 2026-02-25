'use client';

import { ReconciliationPageClient } from '@/components/reconciliation/ReconciliationPageClient';
import { FiscalPeriodsPageClient } from '@/components/fiscal-periods/FiscalPeriodsPageClient';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Scale, Calendar } from 'lucide-react';

interface BankAccountInfo {
  id: string;
  bankName: string;
  accountNumberLast4: string;
  accountType: string | null;
  accountName: string;
  accountCode: string;
}

interface MaintenancePageClientProps {
  slug: string;
  bankAccounts: BankAccountInfo[];
}

export function MaintenancePageClient({ slug, bankAccounts }: MaintenancePageClientProps) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Maintenance</h1>
        <p className="mt-2 text-gray-600">
          Periodic accounting tasks — bank reconciliation and fiscal year-end closing.
        </p>
      </div>

      <Tabs defaultValue="reconciliation" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="reconciliation" className="gap-2">
            <Scale className="h-4 w-4" />
            Reconciliation
          </TabsTrigger>
          <TabsTrigger value="fiscal-periods" className="gap-2">
            <Calendar className="h-4 w-4" />
            Fiscal Periods
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reconciliation">
          <ReconciliationPageClient slug={slug} bankAccounts={bankAccounts} />
        </TabsContent>

        <TabsContent value="fiscal-periods">
          <FiscalPeriodsPageClient organizationSlug={slug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
