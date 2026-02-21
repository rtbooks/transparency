"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import Link from "next/link";

interface OutstandingData {
  payables: { total: number; count: number };
  receivables: { total: number; count: number };
  overdue: { total: number; count: number };
}

interface OutstandingBillsWidgetProps {
  organizationSlug: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function OutstandingBillsWidget({ organizationSlug }: OutstandingBillsWidgetProps) {
  const [data, setData] = useState<OutstandingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/organizations/${organizationSlug}/bills/aging`)
      .then((r) => r.ok ? r.json() : null)
      .then((result) => {
        if (result?.aging) {
          const { payables, receivables } = result.aging;
          // Calculate overdue totals (everything past due)
          const overduePayables = payables.days1to30.amount + payables.days31to60.amount +
            payables.days61to90.amount + payables.days90plus.amount;
          const overduePayablesCount = payables.days1to30.count + payables.days31to60.count +
            payables.days61to90.count + payables.days90plus.count;
          const overdueReceivables = receivables.days1to30.amount + receivables.days31to60.amount +
            receivables.days61to90.amount + receivables.days90plus.amount;
          const overdueReceivablesCount = receivables.days1to30.count + receivables.days31to60.count +
            receivables.days61to90.count + receivables.days90plus.count;

          setData({
            payables: { total: payables.total.amount, count: payables.total.count },
            receivables: { total: receivables.total.amount, count: receivables.total.count },
            overdue: {
              total: overduePayables + overdueReceivables,
              count: overduePayablesCount + overdueReceivablesCount,
            },
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [organizationSlug]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="h-5 w-40 animate-pulse rounded bg-gray-200" /></CardHeader>
        <CardContent><div className="h-16 animate-pulse rounded bg-gray-100" /></CardContent>
      </Card>
    );
  }

  if (!data || (data.payables.count === 0 && data.receivables.count === 0)) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <Link href={`/org/${organizationSlug}/bills`} className="hover:underline">
            Outstanding Bills
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <ArrowUpRight className="h-3 w-3" /> Payables
            </div>
            <div className="text-lg font-semibold">{formatCurrency(data.payables.total)}</div>
            <div className="text-xs text-gray-500">{data.payables.count} bills</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <ArrowDownLeft className="h-3 w-3" /> Receivables
            </div>
            <div className="text-lg font-semibold">{formatCurrency(data.receivables.total)}</div>
            <div className="text-xs text-gray-500">{data.receivables.count} bills</div>
          </div>
          {data.overdue.count > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Overdue</div>
              <div className="text-lg font-semibold text-red-600">{formatCurrency(data.overdue.total)}</div>
              <Badge variant="destructive" className="text-xs">{data.overdue.count} overdue</Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
