import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { checkOrganizationAccess } from '@/lib/organization-access';
import { generateIncomeStatement, generateBalanceSheet } from '@/lib/reporting/temporal-reports';
import {
  getFiscalYearForDate,
  listFiscalYears,
  listFiscalMonths,
} from '@/lib/utils/fiscal-periods';
import { ReportsDashboardClient } from './ReportsDashboardClient';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export const metadata: Metadata = { title: "Reports Dashboard" };

export default async function ReportsDashboardPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  const { organization } = await checkOrganizationAccess(slug, clerkUserId, false);

  const fiscalYearStartDate = new Date(organization.fiscalYearStart);
  const now = new Date();

  // Parse fiscal year selection
  const fyStartStr = sp.fy;
  const referenceDate = fyStartStr ? new Date(fyStartStr) : now;
  const currentFY = getFiscalYearForDate(fiscalYearStartDate, referenceDate);

  // Get monthly data for the fiscal year for charts
  const fyMonths = listFiscalMonths(fiscalYearStartDate, currentFY.start);

  const monthlyData = await Promise.all(
    fyMonths.map(async (month) => {
      const data = await generateIncomeStatement(
        organization.id,
        month.start,
        month.end
      );
      return {
        label: month.label.split(' ')[0], // Just month name
        revenue: data.revenue.total,
        expenses: data.expenses.total,
        netIncome: data.netIncome,
      };
    })
  );

  // Get balance sheet as of end of fiscal year (or now if current year)
  const bsDate = currentFY.end < now ? currentFY.end : now;
  const balanceSheet = await generateBalanceSheet(organization.id, bsDate);

  const assetComposition = [
    { name: 'Current Assets', value: balanceSheet.assets.current.reduce((s, a) => s + a.balance, 0) },
    { name: 'Fixed Assets', value: balanceSheet.assets.fixed.reduce((s, a) => s + a.balance, 0) },
  ].filter((d) => d.value > 0);

  const fiscalYears = listFiscalYears(
    fiscalYearStartDate,
    new Date(organization.createdAt),
    now
  ).map((fy) => ({
    label: fy.label,
    startDate: fy.start.toISOString(),
  }));

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <ReportsDashboardClient
            organizationName={organization.name}
            fiscalYearLabel={currentFY.fiscalYearLabel}
            fiscalYears={fiscalYears}
            currentFiscalYear={currentFY.start.toISOString()}
            monthlyData={monthlyData}
            assetComposition={assetComposition}
            totalAssets={balanceSheet.assets.total}
            totalLiabilities={balanceSheet.liabilities.total}
            totalEquity={balanceSheet.equity.total}
          />
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
