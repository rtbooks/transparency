'use client';

import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReportExportButtonsProps {
  onExportCSV: () => void;
  reportTitle: string;
}

export function ReportExportButtons({
  onExportCSV,
  reportTitle,
}: ReportExportButtonsProps) {
  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={onExportCSV}>
        <Download className="mr-2 h-4 w-4" />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.print()}
      >
        <Printer className="mr-2 h-4 w-4" />
        Print / PDF
      </Button>
    </div>
  );
}
