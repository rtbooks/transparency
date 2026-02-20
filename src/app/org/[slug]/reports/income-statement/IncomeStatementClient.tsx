'use client';

import { PeriodSelector } from '@/components/reports/PeriodSelector';
import { ReportTable, useReportCSV } from '@/components/reports/ReportTable';
import type { ReportSection, ReportRow } from '@/components/reports/ReportTable';
import { ReportExportButtons } from '@/components/reports/ReportExportButtons';
import type { PeriodGranularity } from '@/lib/utils/fiscal-periods';

interface AccountData {
  code: string;
  name: string;
  amount: number;
}

interface IncomeStatementData {
  revenue: { accounts: AccountData[]; total: number };
  expenses: { accounts: AccountData[]; total: number };
  netIncome: number;
}

interface IncomeStatementClientProps {
  organizationName: string;
  reportData: {
    current: IncomeStatementData;
    prior: IncomeStatementData;
    periodLabel: string;
    priorPeriodLabel: string;
  };
  fiscalYears: Array<{ label: string; startDate: string }>;
  quarters: Array<{ quarter: number; label: string; startDate: string }>;
  months: Array<{ label: string; startDate: string }>;
  currentGranularity: PeriodGranularity;
  currentFiscalYear: string;
  currentQuarter?: string;
  currentMonth?: string;
}

function buildAccountRow(
  account: AccountData,
  priorAccounts: AccountData[]
): ReportRow {
  const prior = priorAccounts.find((a) => a.code === account.code);
  return {
    code: account.code,
    name: account.name,
    currentAmount: account.amount,
    priorAmount: prior?.amount ?? 0,
    indent: 1,
  };
}

export function IncomeStatementClient({
  organizationName,
  reportData,
  fiscalYears,
  quarters,
  months,
  currentGranularity,
  currentFiscalYear,
  currentQuarter,
  currentMonth,
}: IncomeStatementClientProps) {
  const { current, prior, periodLabel, priorPeriodLabel } = reportData;

  const sections: ReportSection[] = [
    {
      title: 'Revenue',
      rows: current.revenue.accounts.map((a) =>
        buildAccountRow(a, prior.revenue.accounts)
      ),
      totalRow: {
        name: 'Total Revenue',
        currentAmount: current.revenue.total,
        priorAmount: prior.revenue.total,
        isBold: true,
      },
    },
    {
      title: 'Expenses',
      rows: current.expenses.accounts.map((a) =>
        buildAccountRow(a, prior.expenses.accounts)
      ),
      totalRow: {
        name: 'Total Expenses',
        currentAmount: current.expenses.total,
        priorAmount: prior.expenses.total,
        isBold: true,
      },
    },
  ];

  const grandTotal: ReportRow = {
    name: 'Net Income',
    currentAmount: current.netIncome,
    priorAmount: prior.netIncome,
    isBold: true,
  };

  const exportCSV = useReportCSV(
    'Income_Statement',
    periodLabel,
    priorPeriodLabel,
    sections,
    grandTotal
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Income Statement
          </h1>
          <p className="mt-1 text-gray-600">{organizationName}</p>
          <p className="text-sm text-gray-500">{periodLabel}</p>
        </div>
        <ReportExportButtons
          onExportCSV={exportCSV}
          reportTitle="Income Statement"
        />
      </div>

      <PeriodSelector
        fiscalYears={fiscalYears}
        quarters={quarters}
        months={months}
        currentGranularity={currentGranularity}
        currentFiscalYear={currentFiscalYear}
        currentQuarter={currentQuarter}
        currentMonth={currentMonth}
      />

      <div className="mt-6 rounded-lg bg-white p-6 shadow">
        <ReportTable
          title="Income Statement"
          subtitle={organizationName}
          periodLabel={periodLabel}
          priorPeriodLabel={priorPeriodLabel}
          sections={sections}
          grandTotal={grandTotal}
        />
      </div>
    </div>
  );
}
