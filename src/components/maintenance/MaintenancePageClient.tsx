'use client';

import { useState } from 'react';
import { ReconciliationPageClient } from '@/components/reconciliation/ReconciliationPageClient';
import { FiscalPeriodsPageClient } from '@/components/fiscal-periods/FiscalPeriodsPageClient';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Scale, Calendar, ShieldCheck } from 'lucide-react';

interface BankAccountInfo {
  id: string;
  bankName: string;
  accountNumberLast4: string;
  accountType: string | null;
  accountName: string;
  accountCode: string;
}

interface MaintenancePageClientProps {
  slug: string;
  bankAccounts: BankAccountInfo[];
}

export function MaintenancePageClient({ slug, bankAccounts }: MaintenancePageClientProps) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Maintenance</h1>
        <p className="mt-2 text-gray-600">
          Periodic accounting tasks — bank reconciliation and fiscal year-end closing.
        </p>
      </div>

      <Tabs defaultValue="reconciliation" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="reconciliation" className="gap-2">
            <Scale className="h-4 w-4" />
            Reconciliation
          </TabsTrigger>
          <TabsTrigger value="fiscal-periods" className="gap-2">
            <Calendar className="h-4 w-4" />
            Fiscal Periods
          </TabsTrigger>
          <TabsTrigger value="data-integrity" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Data Integrity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reconciliation">
          <ReconciliationPageClient slug={slug} bankAccounts={bankAccounts} />
        </TabsContent>

        <TabsContent value="fiscal-periods">
          <FiscalPeriodsPageClient organizationSlug={slug} />
        </TabsContent>

        <TabsContent value="data-integrity">
          <RecalculateBalancesSection slug={slug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface Discrepancy {
  accountId: string;
  code: string;
  name: string;
  type: string;
  storedBalance: number;
  expectedBalance: number;
  difference: number;
}

interface RecalculateResult {
  totalAccounts: number;
  discrepanciesFound: number;
  discrepancies: Discrepancy[];
  applied: boolean;
  dryRun: boolean;
}

function RecalculateBalancesSection({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecalculateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async (dryRun: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${slug}/maintenance/recalculate-balances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to check balances');
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Account Balance Verification</h2>
      <p className="mt-1 text-sm text-gray-600">
        Recompute all account balances from transaction history and detect discrepancies.
      </p>

      <div className="mt-4 flex gap-3">
        <Button onClick={() => runCheck(true)} disabled={loading} variant="outline">
          {loading ? 'Checking…' : 'Check for Discrepancies'}
        </Button>
        {result && result.discrepanciesFound > 0 && result.dryRun && (
          <Button
            onClick={() => {
              if (confirm(`This will correct ${result.discrepanciesFound} account balance(s). Continue?`)) {
                runCheck(false);
              }
            }}
            disabled={loading}
            variant="destructive"
          >
            Fix {result.discrepanciesFound} Discrepancies
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="mt-4">
          {result.applied && (
            <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
              ✓ Successfully corrected {result.discrepanciesFound} account balance(s).
            </div>
          )}

          {result.discrepanciesFound === 0 ? (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              ✓ All {result.totalAccounts} account balances are correct.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="pb-2 pr-4">Code</th>
                    <th className="pb-2 pr-4">Account</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4 text-right">Stored</th>
                    <th className="pb-2 pr-4 text-right">Expected</th>
                    <th className="pb-2 text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {result.discrepancies.map((d) => (
                    <tr key={d.accountId} className="border-b">
                      <td className="py-2 pr-4 font-mono">{d.code}</td>
                      <td className="py-2 pr-4">{d.name}</td>
                      <td className="py-2 pr-4">{d.type}</td>
                      <td className="py-2 pr-4 text-right">{fmt(d.storedBalance)}</td>
                      <td className="py-2 pr-4 text-right">{fmt(d.expectedBalance)}</td>
                      <td className={`py-2 text-right font-medium ${d.difference > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {d.difference > 0 ? '+' : ''}{fmt(d.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
