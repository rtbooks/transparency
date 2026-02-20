import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { checkOrganizationAccess } from '@/lib/organization-access';
import { generateIncomeStatement } from '@/lib/reporting/temporal-reports';
import {
  getFiscalYearForDate,
  getPeriodBoundaries,
  getPriorPeriod,
  listFiscalYears,
  listFiscalQuarters,
  listFiscalMonths,
} from '@/lib/utils/fiscal-periods';
import type { PeriodGranularity } from '@/lib/utils/fiscal-periods';
import { IncomeStatementClient } from './IncomeStatementClient';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function IncomeStatementPage({
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

  // Parse search params
  const granularity: PeriodGranularity =
    (sp.granularity as PeriodGranularity) || 'year';
  const fyStartStr = sp.fy;
  const quarterStr = sp.quarter;
  const monthStr = sp.month;

  // Determine reference date for period calculation
  let referenceDate = now;
  if (fyStartStr) {
    referenceDate = new Date(fyStartStr);
  }
  if (granularity === 'quarter' && quarterStr) {
    referenceDate = new Date(quarterStr);
  }
  if (granularity === 'month' && monthStr) {
    referenceDate = new Date(monthStr);
  }

  // Get current and prior periods
  const currentPeriod = getPeriodBoundaries(
    fiscalYearStartDate,
    referenceDate,
    granularity
  );
  const priorPeriod = getPriorPeriod(
    fiscalYearStartDate,
    currentPeriod,
    granularity
  );

  // Fetch both current and prior period data
  const [currentData, priorData] = await Promise.all([
    generateIncomeStatement(
      organization.id,
      currentPeriod.startDate,
      currentPeriod.endDate
    ),
    generateIncomeStatement(
      organization.id,
      priorPeriod.startDate,
      priorPeriod.endDate
    ),
  ]);

  // Build period selector options
  const fiscalYears = listFiscalYears(
    fiscalYearStartDate,
    new Date(organization.createdAt),
    now
  ).map((fy) => ({
    label: fy.label,
    startDate: fy.start.toISOString(),
  }));

  const currentFY = getFiscalYearForDate(fiscalYearStartDate, referenceDate);

  const quarters = listFiscalQuarters(fiscalYearStartDate, currentFY.start).map(
    (q) => ({
      quarter: q.quarter,
      label: q.label,
      startDate: q.start.toISOString(),
    })
  );

  const months = listFiscalMonths(fiscalYearStartDate, currentFY.start).map(
    (m) => ({
      label: m.label,
      startDate: m.start.toISOString(),
    })
  );

  // Serialize report data for client
  const reportData = {
    current: {
      revenue: currentData.revenue,
      expenses: currentData.expenses,
      netIncome: currentData.netIncome,
    },
    prior: {
      revenue: priorData.revenue,
      expenses: priorData.expenses,
      netIncome: priorData.netIncome,
    },
    periodLabel: currentPeriod.label,
    priorPeriodLabel: priorPeriod.label,
  };

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <IncomeStatementClient
            organizationName={organization.name}
            reportData={reportData}
            fiscalYears={fiscalYears}
            quarters={quarters}
            months={months}
            currentGranularity={granularity}
            currentFiscalYear={currentFY.start.toISOString()}
            currentQuarter={quarterStr}
            currentMonth={monthStr}
          />
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
