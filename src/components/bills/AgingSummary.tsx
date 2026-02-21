"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AgingBucket {
  amount: number;
  count: number;
}

interface AgingData {
  current: AgingBucket;
  days1to30: AgingBucket;
  days31to60: AgingBucket;
  days61to90: AgingBucket;
  days90plus: AgingBucket;
  total: AgingBucket;
}

interface AgingSummaryProps {
  organizationSlug: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function AgingTable({ data, label }: { data: AgingData; label: string }) {
  if (data.total.count === 0) {
    return (
      <div className="text-center text-sm text-gray-500 py-4">
        No outstanding {label.toLowerCase()}
      </div>
    );
  }

  const buckets = [
    { label: "Current", data: data.current, variant: "default" as const },
    { label: "1-30 days", data: data.days1to30, variant: "secondary" as const },
    { label: "31-60 days", data: data.days31to60, variant: "outline" as const },
    { label: "61-90 days", data: data.days61to90, variant: "destructive" as const },
    { label: "90+ days", data: data.days90plus, variant: "destructive" as const },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2 text-center">
        {buckets.map((b) => (
          <div key={b.label} className="rounded-lg border p-2">
            <div className="text-xs text-gray-500">{b.label}</div>
            <div className="text-sm font-semibold">
              {formatCurrency(b.data.amount)}
            </div>
            {b.data.count > 0 && (
              <Badge variant={b.variant} className="mt-1 text-xs">
                {b.data.count} {b.data.count === 1 ? "bill" : "bills"}
              </Badge>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t pt-2 text-sm font-semibold">
        <span>Total ({data.total.count} bills)</span>
        <span>{formatCurrency(data.total.amount)}</span>
      </div>
    </div>
  );
}

export function AgingSummary({ organizationSlug }: AgingSummaryProps) {
  const [aging, setAging] = useState<{ payables: AgingData; receivables: AgingData } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/organizations/${organizationSlug}/bills/aging`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setAging(data.aging))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [organizationSlug]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader><CardTitle className="h-5 w-32 animate-pulse rounded bg-gray-200" /></CardHeader>
            <CardContent><div className="h-24 animate-pulse rounded bg-gray-100" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!aging) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounts Payable Aging</CardTitle>
        </CardHeader>
        <CardContent>
          <AgingTable data={aging.payables} label="Payables" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounts Receivable Aging</CardTitle>
        </CardHeader>
        <CardContent>
          <AgingTable data={aging.receivables} label="Receivables" />
        </CardContent>
      </Card>
    </div>
  );
}
