'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PeriodGranularity } from '@/lib/utils/fiscal-periods';

interface FiscalYearOption {
  label: string;
  startDate: string; // ISO string
}

interface QuarterOption {
  quarter: number;
  label: string;
  startDate: string;
}

interface MonthOption {
  label: string;
  startDate: string;
}

interface PeriodSelectorProps {
  fiscalYears: FiscalYearOption[];
  quarters?: QuarterOption[];
  months?: MonthOption[];
  currentGranularity: PeriodGranularity;
  currentFiscalYear: string;
  currentQuarter?: string;
  currentMonth?: string;
}

export function PeriodSelector({
  fiscalYears,
  quarters,
  months,
  currentGranularity,
  currentFiscalYear,
  currentQuarter,
  currentMonth,
}: PeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      {/* Granularity toggle */}
      <div className="flex rounded-md border border-gray-200">
        {(['year', 'quarter', 'month'] as PeriodGranularity[]).map((g) => (
          <Button
            key={g}
            variant={currentGranularity === g ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none first:rounded-l-md last:rounded-r-md"
            onClick={() =>
              updateParams({
                granularity: g,
                quarter: '',
                month: '',
              })
            }
          >
            {g.charAt(0).toUpperCase() + g.slice(1)}
          </Button>
        ))}
      </div>

      {/* Fiscal year dropdown */}
      <Select
        value={currentFiscalYear}
        onValueChange={(value) =>
          updateParams({ fy: value, quarter: '', month: '' })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Fiscal Year" />
        </SelectTrigger>
        <SelectContent>
          {fiscalYears.map((fy) => (
            <SelectItem key={fy.startDate} value={fy.startDate}>
              {fy.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quarter dropdown (shown when granularity is quarter) */}
      {currentGranularity === 'quarter' && quarters && (
        <Select
          value={currentQuarter || quarters[0]?.startDate || ''}
          onValueChange={(value) => updateParams({ quarter: value })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Quarter" />
          </SelectTrigger>
          <SelectContent>
            {quarters.map((q) => (
              <SelectItem key={q.startDate} value={q.startDate}>
                Q{q.quarter}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Month dropdown (shown when granularity is month) */}
      {currentGranularity === 'month' && months && (
        <Select
          value={currentMonth || months[0]?.startDate || ''}
          onValueChange={(value) => updateParams({ month: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.startDate} value={m.startDate}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
