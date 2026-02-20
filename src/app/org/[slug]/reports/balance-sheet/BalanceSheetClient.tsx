'use client';

import { PeriodSelector } from '@/components/reports/PeriodSelector';
import { ReportTable, useReportCSV } from '@/components/reports/ReportTable';
import type { ReportSection, ReportRow } from '@/components/reports/ReportTable';
import { ReportExportButtons } from '@/components/reports/ReportExportButtons';
import type { PeriodGranularity } from '@/lib/utils/fiscal-periods';

interface AccountData {
  code: string;
  name: string;
  balance: number;
}

interface BalanceSheetSectionData {
  assets: {
    current: AccountData[];
    fixed: AccountData[];
    total: number;
  };
  liabilities: {
    current: AccountData[];
    longTerm: AccountData[];
    total: number;
  };
  equity: {
    accounts: AccountData[];
    total: number;
  };
  netWorth: number;
}

interface BalanceSheetClientProps {
  organizationName: string;
  reportData: {
    current: BalanceSheetSectionData;
    prior: BalanceSheetSectionData;
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

function buildBalanceRow(
  account: AccountData,
  priorAccounts: AccountData[]
): ReportRow {
  const prior = priorAccounts.find((a) => a.code === account.code);
  return {
    code: account.code,
    name: account.name,
    currentAmount: account.balance,
    priorAmount: prior?.balance ?? 0,
    indent: 1,
  };
}

export function BalanceSheetClient({
  organizationName,
  reportData,
  fiscalYears,
  quarters,
  months,
  currentGranularity,
  currentFiscalYear,
  currentQuarter,
  currentMonth,
}: BalanceSheetClientProps) {
  const { current, prior, periodLabel, priorPeriodLabel } = reportData;

  const sections: ReportSection[] = [
    // Assets
    {
      title: 'Current Assets',
      rows: current.assets.current.map((a) =>
        buildBalanceRow(a, prior.assets.current)
      ),
    },
    {
      title: 'Fixed Assets',
      rows: current.assets.fixed.map((a) =>
        buildBalanceRow(a, prior.assets.fixed)
      ),
      totalRow: {
        name: 'Total Assets',
        currentAmount: current.assets.total,
        priorAmount: prior.assets.total,
        isBold: true,
      },
    },
    // Liabilities
    {
      title: 'Current Liabilities',
      rows: current.liabilities.current.map((a) =>
        buildBalanceRow(a, prior.liabilities.current)
      ),
    },
    {
      title: 'Long-Term Liabilities',
      rows: current.liabilities.longTerm.map((a) =>
        buildBalanceRow(a, prior.liabilities.longTerm)
      ),
      totalRow: {
        name: 'Total Liabilities',
        currentAmount: current.liabilities.total,
        priorAmount: prior.liabilities.total,
        isBold: true,
      },
    },
    // Equity
    {
      title: 'Equity',
      rows: current.equity.accounts.map((a) =>
        buildBalanceRow(a, prior.equity.accounts)
      ),
      totalRow: {
        name: 'Total Equity',
        currentAmount: current.equity.total,
        priorAmount: prior.equity.total,
        isBold: true,
      },
    },
  ];

  const grandTotal: ReportRow = {
    name: 'Total Liabilities + Equity',
    currentAmount: current.liabilities.total + current.equity.total,
    priorAmount: prior.liabilities.total + prior.equity.total,
    isBold: true,
  };

  const exportCSV = useReportCSV(
    'Balance_Sheet',
    periodLabel,
    priorPeriodLabel,
    sections,
    grandTotal
  );

  // Accounting equation check
  const assetsTotal = current.assets.total;
  const liabilitiesPlusEquity = current.liabilities.total + current.equity.total;
  const isBalanced = Math.abs(assetsTotal - liabilitiesPlusEquity) < 0.01;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Balance Sheet</h1>
          <p className="mt-1 text-gray-600">{organizationName}</p>
          <p className="text-sm text-gray-500">{periodLabel}</p>
        </div>
        <ReportExportButtons
          onExportCSV={exportCSV}
          reportTitle="Balance Sheet"
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

      {/* Accounting equation validation */}
      <div
        className={`mt-4 rounded-lg p-3 text-sm print:hidden ${
          isBalanced
            ? 'bg-green-50 text-green-800'
            : 'bg-red-50 text-red-800'
        }`}
      >
        {isBalanced ? '✓' : '✗'} Assets (${assetsTotal.toLocaleString('en-US', {
          minimumFractionDigits: 2,
        })}) {isBalanced ? '=' : '≠'} Liabilities + Equity ($
        {liabilitiesPlusEquity.toLocaleString('en-US', {
          minimumFractionDigits: 2,
        })})
        {!isBalanced && (
          <span className="ml-2 font-semibold">
            — Difference: $
            {Math.abs(assetsTotal - liabilitiesPlusEquity).toLocaleString(
              'en-US',
              { minimumFractionDigits: 2 }
            )}
          </span>
        )}
      </div>

      <div className="mt-6 rounded-lg bg-white p-6 shadow">
        <ReportTable
          title="Balance Sheet"
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
