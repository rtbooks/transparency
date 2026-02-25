'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BankAccountSummary {
  bankAccountId: string;
  bankName: string;
  accountNumberLast4: string;
  accountName: string;
  accountCode: string;
  totalTransactions: number;
  reconciled: number;
  unreconciled: number;
  completedReconciliations: number;
  lastReconciledAt: string | null;
}

interface UnreconciledTransaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: string;
  referenceNumber: string | null;
  type: string;
}

interface ReconciliationHistoryItem {
  id: string;
  bankAccountId: string;
  statementDate: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: string;
  closingBalance: string;
  fileName: string;
  reconciledAt: string;
  lineCount: number;
}

interface ReportsData {
  bankAccountSummaries: BankAccountSummary[];
  unreconciledTransactions: UnreconciledTransaction[];
  unreconciledCount: number;
  reconciledCount: number;
  reconciliationHistory: ReconciliationHistoryItem[];
}

interface ReconciliationReportsProps {
  slug: string;
}

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

export function ReconciliationReports({ slug }: ReconciliationReportsProps) {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      try {
        const res = await fetch(`/api/organizations/${slug}/reconciliation-reports`);
        if (res.ok) {
          setData(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load reconciliation reports.
        </CardContent>
      </Card>
    );
  }

  const totalTxns = data.reconciledCount + data.unreconciledCount;
  const pctReconciled = totalTxns > 0 ? Math.round((data.reconciledCount / totalTxns) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Transactions</p>
            <p className="text-2xl font-bold mt-1">{totalTxns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Reconciled</p>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {data.reconciledCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">({pctReconciled}%)</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Unreconciled</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{data.unreconciledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Reconciliations Completed</p>
            <p className="text-2xl font-bold mt-1">{data.reconciliationHistory.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per Bank Account Summaries */}
      {data.bankAccountSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Bank Account Summaries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Bank</th>
                    <th className="pb-2 font-medium">Account</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium text-right">Reconciled</th>
                    <th className="pb-2 font-medium text-right">Unreconciled</th>
                    <th className="pb-2 font-medium text-right">Last Reconciled</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bankAccountSummaries.map((ba) => {
                    const pct = ba.totalTransactions > 0
                      ? Math.round((ba.reconciled / ba.totalTransactions) * 100)
                      : 0;
                    return (
                      <tr key={ba.bankAccountId} className="border-b last:border-0">
                        <td className="py-2">
                          {ba.bankName}
                          <span className="text-muted-foreground ml-1">···{ba.accountNumberLast4}</span>
                        </td>
                        <td className="py-2">
                          {ba.accountName} <span className="text-muted-foreground">({ba.accountCode})</span>
                        </td>
                        <td className="py-2 text-right">{ba.totalTransactions}</td>
                        <td className="py-2 text-right text-green-600">
                          {ba.reconciled} <span className="text-muted-foreground">({pct}%)</span>
                        </td>
                        <td className="py-2 text-right text-amber-600">{ba.unreconciled}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {ba.lastReconciledAt
                            ? new Date(ba.lastReconciledAt).toLocaleDateString()
                            : 'Never'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reconciliation History */}
      {data.reconciliationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Reconciliation History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">File</th>
                    <th className="pb-2 font-medium">Period</th>
                    <th className="pb-2 font-medium text-right">Opening</th>
                    <th className="pb-2 font-medium text-right">Closing</th>
                    <th className="pb-2 font-medium text-right">Lines</th>
                    <th className="pb-2 font-medium text-right">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reconciliationHistory.map((h) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{h.fileName}</td>
                      <td className="py-2">
                        {new Date(h.periodStart).toLocaleDateString()} – {new Date(h.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-right font-mono">{formatCurrency(h.openingBalance)}</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(h.closingBalance)}</td>
                      <td className="py-2 text-right">{h.lineCount}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {new Date(h.reconciledAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unreconciled Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Unreconciled Transactions
            {data.unreconciledCount > 0 && (
              <Badge variant="secondary" className="ml-1">{data.unreconciledCount}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.unreconciledTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              All transactions are reconciled! 🎉
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Reference</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.unreconciledTransactions.map((txn) => (
                    <tr key={txn.id} className="border-b last:border-0">
                      <td className="py-2 text-muted-foreground">
                        {new Date(txn.transactionDate).toLocaleDateString()}
                      </td>
                      <td className="py-2">{txn.description}</td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs">{txn.type}</Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">{txn.referenceNumber || '—'}</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(txn.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.unreconciledCount > data.unreconciledTransactions.length && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Showing {data.unreconciledTransactions.length} of {data.unreconciledCount} unreconciled transactions.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
