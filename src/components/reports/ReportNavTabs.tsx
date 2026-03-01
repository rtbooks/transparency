'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, PieChart, FileText } from 'lucide-react';

interface ReportNavTabsProps {
  organizationSlug: string;
}

const REPORT_TABS = [
  { key: 'income-statement', label: 'Income Statement', icon: BarChart3 },
  { key: 'balance-sheet', label: 'Balance Sheet', icon: PieChart },
  { key: 'dashboard', label: 'Dashboard', icon: FileText },
] as const;

export function ReportNavTabs({ organizationSlug }: ReportNavTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 print:hidden">
      {REPORT_TABS.map((tab) => {
        const href = `/org/${organizationSlug}/reports/${tab.key}`;
        const isActive = pathname.includes(tab.key);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.key}
            href={href}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
