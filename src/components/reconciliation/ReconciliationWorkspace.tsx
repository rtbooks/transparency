'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  Link2,
  Unlink,
  SkipForward,
  Loader2,
  Zap,
  DollarSign,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

interface MatchEntry {
  id: string;
  transactionId: string;
  amount: string;
  confidence: string;
}

interface StatementLine {
  id: string;
  transactionDate: string;
  description: string;
  amount: string;
  referenceNumber: string | null;
  matchConfidence: string;
  status: string;
  notes: string | null;
  matches: MatchEntry[];
}

interface LedgerTransaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: string;
  referenceNumber: string | null;
  type: string;
  reconciled: boolean;
}

interface StatementDetail {
  id: string;
  fileName: string;
  statementDate: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: string;
  closingBalance: string;
  status: string;
  lines: StatementLine[];
  unreconciledTransactions: LedgerTransaction[];
}

interface ReconciliationWorkspaceProps {
  slug: string;
  bankAccountId: string;
  statementId: string;
  onBack: () => void;
}

const LINE_STATUS_COLORS: Record<string, string> = {
  UNMATCHED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  MATCHED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  CONFIRMED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  SKIPPED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
};

export function ReconciliationWorkspace({
  slug,
  bankAccountId,
  statementId,
  onBack,
}: ReconciliationWorkspaceProps) {
  const [statement, setStatement] = useState<StatementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const basePath = `/api/organizations/${slug}/bank-accounts/${bankAccountId}/statements/${statementId}`;

  const fetchStatement = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(basePath);
      if (res.ok) {
        const data = await res.json();
        setStatement(data);
      }
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const handleAutoMatch = async () => {
    setActionLoading('auto-match');
    try {
      const res = await fetch(`${basePath}/auto-match`, { method: 'POST' });
      if (res.ok) {
        await fetchStatement();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleMatch = async (lineId: string, transactionId: string) => {
    const line = statement?.lines.find((l) => l.id === lineId);
    if (!line) return;

    // Calculate remaining amount to match
    const lineAmount = Math.abs(parseFloat(line.amount));
    const matchedSoFar = line.matches.reduce((sum, m) => sum + parseFloat(m.amount), 0);
    const remaining = lineAmount - matchedSoFar;

    // For simple click matching, find the transaction amount
    const txn = statement?.unreconciledTransactions.find((t) => t.id === transactionId);
    const matchAmount = txn ? Math.min(Math.abs(parseFloat(txn.amount)), remaining) : remaining;

    setActionLoading(lineId);
    try {
      const res = await fetch(`${basePath}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'match',
          transactionId,
          amount: matchAmount,
        }),
      });
      if (res.ok) {
        await fetchStatement();
        // Only deselect if line is now fully matched
        const updated = await res.json();
        if (updated.status === 'MATCHED') {
          setSelectedLine(null);
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMatch = async (lineId: string, matchId: string) => {
    setActionLoading(lineId);
    try {
      const res = await fetch(`${basePath}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-match', matchId }),
      });
      if (res.ok) {
        await fetchStatement();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnmatch = async (lineId: string) => {
    setActionLoading(lineId);
    try {
      const res = await fetch(`${basePath}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unmatch' }),
      });
      if (res.ok) {
        await fetchStatement();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSkip = async (lineId: string) => {
    setActionLoading(lineId);
    try {
      const res = await fetch(`${basePath}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      });
      if (res.ok) {
        await fetchStatement();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async () => {
    setActionLoading('complete');
    try {
      const res = await fetch(`${basePath}/complete`, { method: 'POST' });
      if (res.ok) {
        setShowComplete(false);
        await fetchStatement();
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !statement) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const lines = statement.lines;
  const filteredLines = statusFilter === 'ALL' ? lines : lines.filter((l) => l.status === statusFilter);
  const matched = lines.filter((l) => l.status === 'MATCHED' || l.status === 'CONFIRMED').length;
  const unmatched = lines.filter((l) => l.status === 'UNMATCHED').length;
  const skipped = lines.filter((l) => l.status === 'SKIPPED').length;
  const isCompleted = statement.status === 'COMPLETED';

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h2 className="text-lg font-bold">{statement.fileName}</h2>
            <p className="text-xs text-muted-foreground">
              {new Date(statement.periodStart).toLocaleDateString()} – {new Date(statement.periodEnd).toLocaleDateString()}
              {' · '}
              Opening: {formatCurrency(statement.openingBalance)} · Closing: {formatCurrency(statement.closingBalance)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isCompleted && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoMatch}
                disabled={actionLoading === 'auto-match'}
              >
                {actionLoading === 'auto-match' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-1" />
                )}
                Auto-Match
              </Button>
              <Button
                size="sm"
                onClick={() => setShowComplete(true)}
                disabled={unmatched > 0 && skipped === 0}
              >
                <Check className="h-4 w-4 mr-1" />
                Complete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="cursor-pointer" onClick={() => setStatusFilter('ALL')}>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">{lines.length}</p>
            <p className="text-xs text-muted-foreground">Total Lines</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('MATCHED')}>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{matched}</p>
            <p className="text-xs text-muted-foreground">Matched</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('UNMATCHED')}>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-gray-600">{unmatched}</p>
            <p className="text-xs text-muted-foreground">Unmatched</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('SKIPPED')}>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{skipped}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </CardContent>
        </Card>
      </div>

      {/* Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Panel: Bank Statement Lines */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Bank Statement Lines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[60vh] overflow-y-auto">
            {filteredLines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No lines match the current filter.
              </p>
            ) : (
              filteredLines.map((line) => {
                const lineAmount = Math.abs(parseFloat(line.amount));
                const matchedAmount = line.matches.reduce((sum, m) => sum + parseFloat(m.amount), 0);
                const remaining = lineAmount - matchedAmount;
                const hasPartialMatch = line.matches.length > 0 && remaining > 0.01;

                return (
                <div
                  key={line.id}
                  className={`border rounded-md p-3 text-sm transition-colors ${
                    selectedLine === line.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  } ${isCompleted ? '' : 'cursor-pointer'}`}
                  onClick={() => !isCompleted && (line.status === 'UNMATCHED' || hasPartialMatch) && setSelectedLine(line.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(line.transactionDate).toLocaleDateString()}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${LINE_STATUS_COLORS[line.status]}`}>
                          {line.status}
                        </span>
                        {line.matchConfidence && line.matchConfidence !== 'UNMATCHED' && (
                          <span className="text-xs text-muted-foreground">
                            ({line.matchConfidence.replace('AUTO_', '')})
                          </span>
                        )}
                        {hasPartialMatch && (
                          <span className="text-xs text-amber-600 font-medium">
                            Partial ({formatCurrency(remaining)} remaining)
                          </span>
                        )}
                      </div>
                      <p className="truncate mt-0.5">{line.description}</p>
                      {/* Show matched transactions */}
                      {line.matches.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {line.matches.map((match) => {
                            const txn = statement.unreconciledTransactions.find((t) => t.id === match.transactionId) ||
                              (statement as any)._matchedTxnCache?.[match.transactionId];
                            return (
                              <div key={match.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Link2 className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{txn?.description || match.transactionId.slice(0, 8)}</span>
                                {line.matches.length > 1 && (
                                  <span className="font-mono text-primary">({formatCurrency(match.amount)})</span>
                                )}
                                {!isCompleted && (
                                  <button
                                    className="ml-1 text-destructive hover:text-destructive/80"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveMatch(line.id, match.id);
                                    }}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className={`font-mono font-medium ${parseFloat(line.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(line.amount)}
                      </p>
                      {!isCompleted && line.status === 'MATCHED' && !hasPartialMatch && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnmatch(line.id);
                          }}
                          disabled={actionLoading === line.id}
                        >
                          <Unlink className="h-3 w-3 mr-1" />
                          Unmatch All
                        </Button>
                      )}
                      {!isCompleted && line.status === 'UNMATCHED' && line.matches.length === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSkip(line.id);
                          }}
                          disabled={actionLoading === line.id}
                        >
                          <SkipForward className="h-3 w-3 mr-1" />
                          Skip
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right Panel: Ledger Transactions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Unreconciled Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[60vh] overflow-y-auto">
            {selectedLine ? (
              <>
                {(() => {
                  const selLine = statement.lines.find((l) => l.id === selectedLine);
                  const selAmount = selLine ? Math.abs(parseFloat(selLine.amount)) : 0;
                  const selMatched = selLine ? selLine.matches.reduce((s, m) => s + parseFloat(m.amount), 0) : 0;
                  const selRemaining = selAmount - selMatched;
                  return (
                    <div className="text-xs text-muted-foreground mb-2 space-y-1">
                      <p>Select a transaction to match with the highlighted bank line.</p>
                      {selMatched > 0 && (
                        <p className="text-amber-600 font-medium">
                          {formatCurrency(selMatched)} matched · {formatCurrency(selRemaining)} remaining of {formatCurrency(selAmount)}
                        </p>
                      )}
                    </div>
                  );
                })()}
                {statement.unreconciledTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No unreconciled transactions found.
                  </p>
                ) : (
                  statement.unreconciledTransactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="border rounded-md p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleMatch(selectedLine, txn.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(txn.transactionDate).toLocaleDateString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {txn.type}
                            </Badge>
                          </div>
                          <p className="truncate mt-0.5">{txn.description}</p>
                          {txn.referenceNumber && (
                            <p className="text-xs text-muted-foreground">Ref: {txn.referenceNumber}</p>
                          )}
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <p className="font-mono font-medium">{formatCurrency(txn.amount)}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs mt-1"
                            disabled={actionLoading === selectedLine}
                          >
                            {actionLoading === selectedLine ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Link2 className="h-3 w-3 mr-1" />
                                Match
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {isCompleted
                    ? 'Reconciliation is complete.'
                    : 'Click an unmatched bank line to start matching.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Complete Reconciliation Dialog */}
      {showComplete && (
        <Dialog open onOpenChange={(open) => !open && setShowComplete(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Complete Reconciliation
              </DialogTitle>
              <DialogDescription>
                Review the summary below before finalizing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Total lines:</div>
                <div className="font-medium">{lines.length}</div>
                <div className="text-muted-foreground">Matched:</div>
                <div className="font-medium text-green-600">{matched}</div>
                <div className="text-muted-foreground">Skipped:</div>
                <div className="font-medium text-yellow-600">{skipped}</div>
                <div className="text-muted-foreground">Unmatched:</div>
                <div className="font-medium text-red-600">{unmatched}</div>
              </div>
              {unmatched > 0 && (
                <div className="flex items-start gap-2 text-yellow-700 bg-yellow-50 dark:bg-yellow-950/20 dark:text-yellow-200 p-3 rounded-md">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {unmatched} line(s) are still unmatched. They will be excluded from reconciliation.
                    Consider skipping them first or matching them.
                  </span>
                </div>
              )}
              <p className="text-muted-foreground">
                All matched transactions will be marked as reconciled. This action cannot be undone.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowComplete(false)}>
                Cancel
              </Button>
              <Button onClick={handleComplete} disabled={actionLoading === 'complete'}>
                {actionLoading === 'complete' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Finalize
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
