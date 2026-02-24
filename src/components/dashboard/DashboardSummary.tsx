'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/account-tree';
import { DollarSign, TrendingUp, TrendingDown, ArrowRightLeft, AlertTriangle, Landmark } from 'lucide-react';

interface AccountData {
  type: string;
  currentBalance: number;
}

interface RecentTransaction {
  id: string;
  transactionDate: string;
  type: string;
  amount: number;
  description: string;
  debitAccount: { code: string; name: string };
  creditAccount: { code: string; name: string };
}

interface DashboardSummaryProps {
  organizationSlug: string;
}

export function DashboardSummary({ organizationSlug }: DashboardSummaryProps) {
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [last30dRevenue, setLast30dRevenue] = useState(0);
  const [last30dExpenses, setLast30dExpenses] = useState(0);
  const [overdraftAlerts, setOverdraftAlerts] = useState<Array<{
    accountId: string;
    accountName: string;
    currentBalance: number;
    pendingPayables: number;
    projectedBalance: number;
    pendingBillCount: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [accountsRes, recentTxRes, revenueTxRes, expenseTxRes, overdraftRes] = await Promise.all([
          fetch(`/api/organizations/${organizationSlug}/accounts`),
          fetch(`/api/organizations/${organizationSlug}/transactions?limit=10`),
          fetch(`/api/organizations/${organizationSlug}/transactions?type=INCOME&startDate=${thirtyDaysAgo}&endDate=${today}&limit=1`),
          fetch(`/api/organizations/${organizationSlug}/transactions?type=EXPENSE&startDate=${thirtyDaysAgo}&endDate=${today}&limit=1`),
          fetch(`/api/organizations/${organizationSlug}/overdraft-alerts`),
        ]);

        if (!accountsRes.ok || !recentTxRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        setAccounts(await accountsRes.json());

        const recentData = await recentTxRes.json();
        setRecentTransactions(recentData.transactions || []);

        // Extract totals from pagination metadata
        if (revenueTxRes.ok) {
          const revData = await revenueTxRes.json();
          const revTxs = revData.transactions || [];
          // Sum amounts from all revenue transactions in the period
          // We only got 1 page — use a separate sum approach
          setLast30dRevenue(revData.periodTotal ?? revTxs.reduce((s: number, t: RecentTransaction) => s + Number(t.amount), 0));
        }
        if (expenseTxRes.ok) {
          const expData = await expenseTxRes.json();
          const expTxs = expData.transactions || [];
          setLast30dExpenses(expData.periodTotal ?? expTxs.reduce((s: number, t: RecentTransaction) => s + Number(t.amount), 0));
        }

        if (overdraftRes.ok) {
          const overdraftData = await overdraftRes.json();
          setOverdraftAlerts(overdraftData.alerts || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [organizationSlug, thirtyDaysAgo, today]);

  const totalAssets = useMemo(
    () => accounts.filter(a => a.type === 'ASSET').reduce((s, a) => s + Number(a.currentBalance), 0),
    [accounts]
  );
  const totalLiabilities = useMemo(
    () => accounts.filter(a => a.type === 'LIABILITY').reduce((s, a) => s + Number(a.currentBalance), 0),
    [accounts]
  );

  const getTransactionTypeBadge = (type: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      INCOME: { variant: 'default', label: 'Income' },
      EXPENSE: { variant: 'destructive', label: 'Expense' },
      TRANSFER: { variant: 'secondary', label: 'Transfer' },
    };
    const config = variants[type] || { variant: 'outline' as const, label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-800">
        <p className="font-semibold">Error loading dashboard</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAssets)}</div>
            <p className="text-xs text-muted-foreground">
              Current balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalLiabilities)}</div>
            <p className="text-xs text-muted-foreground">
              Current balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(last30dRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{formatCurrency(last30dExpenses)}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overdraft Alerts */}
      {overdraftAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-red-800">
              <AlertTriangle className="h-5 w-5" />
              Overdraft Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-red-700">
              The following accounts may go negative after pending payable bills are paid:
            </p>
            <div className="space-y-2">
              {overdraftAlerts.map((alert) => (
                <div
                  key={alert.accountId}
                  className="flex items-center justify-between rounded-md border border-red-200 bg-white p-3"
                >
                  <div>
                    <div className="font-medium text-gray-900">{alert.accountName}</div>
                    <div className="text-xs text-gray-500">
                      {alert.pendingBillCount} pending bill{alert.pendingBillCount !== 1 ? 's' : ''} · 
                      Payables: {formatCurrency(alert.pendingPayables)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      Balance: {formatCurrency(alert.currentBalance)}
                    </div>
                    <div className="text-sm font-bold text-red-600">
                      Projected: {formatCurrency(alert.projectedBalance)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No transactions recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {getTransactionTypeBadge(tx.type)}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{tx.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(tx.transactionDate).toLocaleDateString()} &middot;{' '}
                        {tx.debitAccount.code} → {tx.creditAccount.code}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 text-right font-semibold whitespace-nowrap">
                    {formatCurrency(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
