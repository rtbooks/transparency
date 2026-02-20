'use client';

import { useCallback } from 'react';

export interface ReportRow {
  code?: string;
  name: string;
  currentAmount: number;
  priorAmount?: number;
  isHeader?: boolean;
  isTotal?: boolean;
  isBold?: boolean;
  indent?: number;
}

export interface ReportSection {
  title: string;
  rows: ReportRow[];
  totalRow?: ReportRow;
}

interface ReportTableProps {
  title: string;
  subtitle?: string;
  periodLabel: string;
  priorPeriodLabel?: string;
  sections: ReportSection[];
  grandTotal?: ReportRow;
  showComparative?: boolean;
}

function formatCurrency(amount: number): string {
  if (amount < 0) {
    return `(${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calculateChange(current: number, prior: number): { amount: number; percentage: number | null } {
  const amount = current - prior;
  const percentage = prior !== 0 ? ((current - prior) / Math.abs(prior)) * 100 : null;
  return { amount, percentage };
}

export function ReportTable({
  title,
  subtitle,
  periodLabel,
  priorPeriodLabel,
  sections,
  grandTotal,
  showComparative = true,
}: ReportTableProps) {
  const hasComparative = showComparative && priorPeriodLabel;

  return (
    <div className="report-table">
      {/* Header - hidden on screen if parent provides it, shown in print */}
      <div className="mb-6 hidden print:block print:text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
        <p className="text-sm text-gray-500">{periodLabel}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="py-2 pr-4 text-left text-sm font-semibold text-gray-700">
                Account
              </th>
              <th className="w-40 py-2 text-right text-sm font-semibold text-gray-700">
                {periodLabel}
              </th>
              {hasComparative && (
                <>
                  <th className="w-40 py-2 text-right text-sm font-semibold text-gray-700">
                    {priorPeriodLabel}
                  </th>
                  <th className="w-32 py-2 text-right text-sm font-semibold text-gray-700">
                    Change
                  </th>
                  <th className="w-20 py-2 text-right text-sm font-semibold text-gray-700">
                    %
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sections.map((section, sIdx) => (
              <ReportSectionRows
                key={sIdx}
                section={section}
                hasComparative={!!hasComparative}
              />
            ))}
            {grandTotal && (
              <tr className="border-t-4 border-double border-gray-800 font-bold">
                <td className="py-2 pr-4 text-sm">
                  {grandTotal.name}
                </td>
                <td className="py-2 text-right text-sm">
                  ${formatCurrency(grandTotal.currentAmount)}
                </td>
                {hasComparative && grandTotal.priorAmount !== undefined && (
                  <>
                    <td className="py-2 text-right text-sm">
                      ${formatCurrency(grandTotal.priorAmount)}
                    </td>
                    <ChangeColumns current={grandTotal.currentAmount} prior={grandTotal.priorAmount} />
                  </>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportSectionRows({
  section,
  hasComparative,
}: {
  section: ReportSection;
  hasComparative: boolean;
}) {
  return (
    <>
      {/* Section header */}
      <tr>
        <td
          colSpan={hasComparative ? 5 : 2}
          className="pb-1 pt-4 text-sm font-bold text-gray-900 uppercase"
        >
          {section.title}
        </td>
      </tr>

      {/* Account rows */}
      {section.rows.map((row, rIdx) => (
        <tr
          key={rIdx}
          className={`${row.isTotal || row.isBold ? 'font-semibold' : ''} ${
            row.isTotal ? 'border-t border-gray-300' : ''
          }`}
        >
          <td
            className="py-1 pr-4 text-sm text-gray-800"
            style={{ paddingLeft: `${(row.indent || 0) * 1.5 + 0.5}rem` }}
          >
            {row.code && (
              <span className="mr-2 text-gray-400">{row.code}</span>
            )}
            {row.name}
          </td>
          <td className="py-1 text-right text-sm text-gray-800">
            ${formatCurrency(row.currentAmount)}
          </td>
          {hasComparative && row.priorAmount !== undefined && (
            <>
              <td className="py-1 text-right text-sm text-gray-800">
                ${formatCurrency(row.priorAmount)}
              </td>
              <ChangeColumns current={row.currentAmount} prior={row.priorAmount} />
            </>
          )}
          {hasComparative && row.priorAmount === undefined && (
            <>
              <td className="py-1 text-right text-sm text-gray-400">—</td>
              <td className="py-1 text-right text-sm text-gray-400">—</td>
              <td className="py-1 text-right text-sm text-gray-400">—</td>
            </>
          )}
        </tr>
      ))}

      {/* Section total */}
      {section.totalRow && (
        <tr className="border-t border-gray-300 font-bold">
          <td className="py-1 pr-4 text-sm" style={{ paddingLeft: '0.5rem' }}>
            {section.totalRow.name}
          </td>
          <td className="py-1 text-right text-sm">
            ${formatCurrency(section.totalRow.currentAmount)}
          </td>
          {hasComparative && section.totalRow.priorAmount !== undefined && (
            <>
              <td className="py-1 text-right text-sm">
                ${formatCurrency(section.totalRow.priorAmount)}
              </td>
              <ChangeColumns current={section.totalRow.currentAmount} prior={section.totalRow.priorAmount} />
            </>
          )}
        </tr>
      )}
    </>
  );
}

function ChangeColumns({ current, prior }: { current: number; prior: number }) {
  const { amount, percentage } = calculateChange(current, prior);
  const colorClass = amount >= 0 ? 'text-green-700' : 'text-red-700';

  return (
    <>
      <td className={`py-1 text-right text-sm ${colorClass}`}>
        {amount >= 0 ? '' : '-'}${formatCurrency(Math.abs(amount))}
      </td>
      <td className={`py-1 text-right text-sm ${colorClass}`}>
        {percentage !== null ? `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%` : '—'}
      </td>
    </>
  );
}

/**
 * Hook to generate CSV from report sections.
 */
export function useReportCSV(
  title: string,
  periodLabel: string,
  priorPeriodLabel: string | undefined,
  sections: ReportSection[],
  grandTotal?: ReportRow
) {
  return useCallback(() => {
    const hasComparative = !!priorPeriodLabel;
    const headers = hasComparative
      ? ['Account', periodLabel, priorPeriodLabel!, 'Change', 'Change %']
      : ['Account', periodLabel];
    const rows: string[][] = [headers];

    for (const section of sections) {
      rows.push([section.title]);
      for (const row of section.rows) {
        const line = [
          `${'  '.repeat(row.indent || 0)}${row.code ? row.code + ' ' : ''}${row.name}`,
          row.currentAmount.toFixed(2),
        ];
        if (hasComparative) {
          const prior = row.priorAmount ?? 0;
          const change = calculateChange(row.currentAmount, prior);
          line.push(prior.toFixed(2), change.amount.toFixed(2), change.percentage !== null ? `${change.percentage.toFixed(1)}%` : '');
        }
        rows.push(line);
      }
      if (section.totalRow) {
        const line = [section.totalRow.name, section.totalRow.currentAmount.toFixed(2)];
        if (hasComparative) {
          const prior = section.totalRow.priorAmount ?? 0;
          const change = calculateChange(section.totalRow.currentAmount, prior);
          line.push(prior.toFixed(2), change.amount.toFixed(2), change.percentage !== null ? `${change.percentage.toFixed(1)}%` : '');
        }
        rows.push(line);
      }
    }
    if (grandTotal) {
      const line = [grandTotal.name, grandTotal.currentAmount.toFixed(2)];
      if (hasComparative && grandTotal.priorAmount !== undefined) {
        const change = calculateChange(grandTotal.currentAmount, grandTotal.priorAmount);
        line.push(grandTotal.priorAmount.toFixed(2), change.amount.toFixed(2), change.percentage !== null ? `${change.percentage.toFixed(1)}%` : '');
      }
      rows.push(line);
    }

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [title, periodLabel, priorPeriodLabel, sections, grandTotal]);
}
