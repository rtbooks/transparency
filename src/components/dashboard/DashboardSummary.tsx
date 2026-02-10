'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/account-tree';
import { DollarSign, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';

interface AccountSummary {
  type: string;
  total: number;
  count: number;
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
  const [accountSummary, setAccountSummary] = useState<AccountSummary[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [accountsRes, transactionsRes] = await Promise.all([
          fetch(`/api/organizations/${organizationSlug}/accounts`),
          fetch(`/api/organizations/${organizationSlug}/transactions?limit=5`),
        ]);

        if (!accountsRes.ok || !transactionsRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const accounts = await accountsRes.json();
        const transactionsData = await transactionsRes.json();

        // Summarize accounts by type
        const summaryMap: Record<string, AccountSummary> = {};
        for (const account of accounts) {
          if (!summaryMap[account.type]) {
            summaryMap[account.type] = { type: account.type, total: 0, count: 0 };
          }
          summaryMap[account.type].count += 1;
          summaryMap[account.type].total += Number(account.balance) || 0;
        }
        setAccountSummary(Object.values(summaryMap));
        setTotalAccounts(accounts.length);

        setRecentTransactions(transactionsData.transactions || []);
        setTotalTransactions(transactionsData.pagination?.totalCount || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [organizationSlug]);

  const getTransactionTypeBadge = (type: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      INCOME: { variant: 'default', label: 'Income' },
      EXPENSE: { variant: 'destructive', label: 'Expense' },
      TRANSFER: { variant: 'secondary', label: 'Transfer' },
    };
    const config = variants[type] || { variant: 'outline' as const, label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'REVENUE': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'EXPENSE': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'ASSET': return <DollarSign className="h-4 w-4 text-blue-600" />;
      default: return <ArrowRightLeft className="h-4 w-4 text-gray-600" />;
    }
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
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAccounts}</div>
            <p className="text-xs text-muted-foreground">
              {accountSummary.length} account type{accountSummary.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>

        {accountSummary
          .filter(s => s.type === 'REVENUE' || s.type === 'EXPENSE')
          .map(summary => (
            <Card key={summary.type}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {summary.type === 'REVENUE' ? 'Revenue Accounts' : 'Expense Accounts'}
                </CardTitle>
                {getAccountTypeIcon(summary.type)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.total)}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.count} account{summary.count !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Account Summary by Type */}
      {accountSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Accounts by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accountSummary.map(summary => (
                <div key={summary.type} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {getAccountTypeIcon(summary.type)}
                    <div>
                      <div className="font-medium">{summary.type}</div>
                      <div className="text-sm text-muted-foreground">
                        {summary.count} account{summary.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-semibold">
                    {formatCurrency(summary.total)}
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
