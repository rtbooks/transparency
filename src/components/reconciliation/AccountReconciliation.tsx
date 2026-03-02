'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, Clock, Trash2, Loader2, Scale, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

// ── Types ────────────────────────────────────────────────────────────

interface AccountOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface ReconciliationSummary {
  id: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  periodStart: string;
  periodEnd: string;
  beginningBalance: number;
  endingBalance: number;
  status: string;
  completedBy: string | null;
  completedAt: string | null;
  itemCount: number;
  createdAt: string;
}

interface TransactionItem {
  id: string;
  transactionId: string;
  transactionDate: string;
  description: string;
  amount: number;
  type: string;
  referenceNumber: string | null;
  reconciled?: boolean;
}

interface ReconciliationDetail {
  id: string;
  accountName: string;
  accountCode: string;
  periodStart: string;
  periodEnd: string;
  beginningBalance: number;
  endingBalance: number;
  status: string;
  clearedItems: TransactionItem[];
  availableTransactions: TransactionItem[];
  difference: number;
}

// ── Props ────────────────────────────────────────────────────────────

interface AccountReconciliationProps {
  slug: string;
}

// ── Formatting helpers ──────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ── Main Component ──────────────────────────────────────────────────

export function AccountReconciliation({ slug }: AccountReconciliationProps) {
  const [reconciliations, setReconciliations] = useState<ReconciliationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeReconciliationId, setActiveReconciliationId] = useState<string | null>(null);

  const fetchReconciliations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/organizations/${slug}/reconciliations`);
      if (res.ok) setReconciliations(await res.json());
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchReconciliations(); }, [fetchReconciliations]);

  // Workspace view
  if (activeReconciliationId) {
    return (
      <ReconciliationWorkspace
        slug={slug}
        reconciliationId={activeReconciliationId}
        onBack={() => {
          setActiveReconciliationId(null);
          fetchReconciliations();
        }}
      />
    );
  }

  const inProgress = reconciliations.filter((r) => r.status === 'IN_PROGRESS');
  const completed = reconciliations.filter((r) => r.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Account Reconciliation</h2>
          <p className="text-sm text-muted-foreground">
            Verify cleared transactions against your bank statement balance.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Start Reconciliation
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : reconciliations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Scale className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No Reconciliations Yet</p>
            <p className="text-sm mt-1">
              Start a reconciliation to verify your bank account balances against the ledger.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* In-Progress */}
          {inProgress.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">In Progress</h3>
              {inProgress.map((r) => (
                <ReconciliationCard key={r.id} reconciliation={r} onClick={() => setActiveReconciliationId(r.id)} />
              ))}
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Completed</h3>
              {completed.map((r) => (
                <ReconciliationCard key={r.id} reconciliation={r} onClick={() => setActiveReconciliationId(r.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {showCreate && (
        <StartReconciliationDialog
          slug={slug}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            setActiveReconciliationId(id);
          }}
        />
      )}
    </div>
  );
}

// ── Reconciliation List Card ────────────────────────────────────────

function ReconciliationCard({ reconciliation: r, onClick }: { reconciliation: ReconciliationSummary; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={onClick}>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-4">
          {r.status === 'COMPLETED' ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <Clock className="h-5 w-5 text-blue-600" />
          )}
          <div>
            <p className="font-medium text-sm">{r.accountName} ({r.accountCode})</p>
            <p className="text-xs text-muted-foreground">
              {fmtDate(r.periodStart)} — {fmtDate(r.periodEnd)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p>{fmt(r.endingBalance)}</p>
            <p className="text-xs text-muted-foreground">{r.itemCount} items</p>
          </div>
          <Badge variant={r.status === 'COMPLETED' ? 'outline' : 'default'}>
            {r.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Start Reconciliation Dialog ─────────────────────────────────────

function StartReconciliationDialog({
  slug,
  onClose,
  onCreated,
}: {
  slug: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [beginningBalance, setBeginningBalance] = useState('');
  const [endingBalance, setEndingBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch asset accounts
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/organizations/${slug}/accounts`);
        if (res.ok) {
          const data: AccountOption[] = await res.json();
          setAccounts(data.filter((a) => a.type === 'ASSET'));
        }
      } finally {
        setLoadingAccounts(false);
      }
    })();
  }, [slug]);

  // Auto-populate beginning balance when account is selected
  useEffect(() => {
    if (!accountId) return;
    (async () => {
      try {
        const res = await fetch(`/api/organizations/${slug}/reconciliations/last-balance?accountId=${accountId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.endingBalance !== null) {
            setBeginningBalance(String(data.endingBalance));
          }
        }
      } catch { /* ignore */ }
    })();
  }, [accountId, slug]);

  const handleSubmit = async () => {
    if (!accountId || !periodStart || !periodEnd) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${slug}/reconciliations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          periodStart,
          periodEnd,
          beginningBalance: parseFloat(beginningBalance) || 0,
          endingBalance: parseFloat(endingBalance) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create reconciliation');
      }
      const created = await res.json();
      onCreated(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Reconciliation</DialogTitle>
          <DialogDescription>
            Select an account and enter the period and balances from your bank statement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Account</Label>
            {loadingAccounts ? (
              <p className="text-sm text-muted-foreground">Loading accounts...</p>
            ) : (
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an asset account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Period Start</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label>Period End</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Beginning Balance</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={beginningBalance}
                onChange={(e) => setBeginningBalance(e.target.value)}
              />
            </div>
            <div>
              <Label>Ending Balance</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={endingBalance}
                onChange={(e) => setEndingBalance(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Reconciliation Workspace ────────────────────────────────────────

function ReconciliationWorkspace({
  slug,
  reconciliationId,
  onBack,
}: {
  slug: string;
  reconciliationId: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<ReconciliationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${slug}/reconciliations/${reconciliationId}`);
      if (res.ok) setDetail(await res.json());
    } finally {
      setLoading(false);
    }
  }, [slug, reconciliationId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleToggle = async (transactionId: string) => {
    setToggling(transactionId);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${slug}/reconciliations/${reconciliationId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Toggle failed');
      }
      await fetchDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setToggling(null);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Complete this reconciliation? Cleared transactions will be marked as reconciled.')) return;
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${slug}/reconciliations/${reconciliationId}/complete`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Completion failed');
      }
      await fetchDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCompleting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this in-progress reconciliation? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await fetch(`/api/organizations/${slug}/reconciliations/${reconciliationId}`, {
        method: 'DELETE',
      });
      onBack();
    } catch {
      setDeleting(false);
    }
  };

  if (loading || !detail) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isCompleted = detail.status === 'COMPLETED';

  type MergedTransaction = {
    txId: string;
    transactionDate: string;
    description: string;
    amount: number;
    type: string;
    referenceNumber: string | null;
    cleared: boolean;
    reconciled?: boolean;
  };

  const allTransactions: MergedTransaction[] = [
    ...detail.clearedItems.map((t) => ({
      txId: t.transactionId,
      transactionDate: t.transactionDate,
      description: t.description,
      amount: t.amount,
      type: t.type,
      referenceNumber: t.referenceNumber,
      cleared: true,
    })),
    ...detail.availableTransactions.map((t) => ({
      txId: t.id,
      transactionDate: t.transactionDate,
      description: t.description,
      amount: t.amount,
      type: t.type,
      referenceNumber: t.referenceNumber,
      cleared: false,
      reconciled: t.reconciled,
    })),
  ].sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  const clearedTotal = detail.clearedItems.reduce((sum, t) => sum + t.amount, 0);
  const computedEnding = detail.beginningBalance + clearedTotal;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h2 className="text-lg font-semibold">
              {detail.accountName} ({detail.accountCode})
            </h2>
            <p className="text-sm text-muted-foreground">
              {fmtDate(detail.periodStart)} — {fmtDate(detail.periodEnd)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isCompleted && (
            <>
              <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={completing || Math.abs(detail.difference) > 0.005}
              >
                {completing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Complete
              </Button>
            </>
          )}
          {isCompleted && <Badge variant="outline">Completed</Badge>}
        </div>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Beginning Balance</p>
            <p className="text-lg font-semibold">{fmt(detail.beginningBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Cleared Items</p>
            <p className="text-lg font-semibold">{fmt(clearedTotal)}</p>
            <p className="text-xs text-muted-foreground">{detail.clearedItems.length} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Computed Ending</p>
            <p className="text-lg font-semibold">{fmt(computedEnding)}</p>
          </CardContent>
        </Card>
        <Card className={Math.abs(detail.difference) > 0.005 ? 'border-red-300' : 'border-green-300'}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Difference</p>
            <p className={`text-lg font-semibold ${Math.abs(detail.difference) > 0.005 ? 'text-red-600' : 'text-green-600'}`}>
              {fmt(detail.difference)}
            </p>
            <p className="text-xs text-muted-foreground">
              {Math.abs(detail.difference) <= 0.005 ? 'Balanced ✓' : 'Must be $0.00 to complete'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Statement ending balance reference */}
      <div className="text-sm text-muted-foreground px-1">
        Statement ending balance: <span className="font-medium text-foreground">{fmt(detail.endingBalance)}</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Transaction List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Transactions in Period</CardTitle>
        </CardHeader>
        <CardContent>
          {allTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No transactions found for this account and period.
            </p>
          ) : (
            <div className="divide-y">
              {allTransactions.map((tx) => (
                  <div
                    key={tx.txId}
                    className={`flex items-center gap-3 py-2 px-1 ${
                      tx.cleared ? 'bg-green-50/50' : ''
                    } ${toggling === tx.txId ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      checked={tx.cleared}
                      disabled={isCompleted || toggling !== null}
                      onCheckedChange={() => handleToggle(tx.txId)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(tx.transactionDate)}
                        {tx.referenceNumber && ` · #${tx.referenceNumber}`}
                        {' · '}{tx.type}
                        {tx.reconciled && (
                          <span className="text-green-600 ml-1">(previously reconciled)</span>
                        )}
                      </p>
                    </div>
                    <p className={`text-sm font-medium tabular-nums ${
                      tx.amount >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                    </p>
                  </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
