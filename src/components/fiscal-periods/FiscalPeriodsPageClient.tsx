'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Plus, Lock, Unlock, Eye, Loader2, AlertTriangle } from 'lucide-react';

interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
  closedAt: string | null;
  closedBy: string | null;
  reopenedAt: string | null;
  closingTransactionIds: string[];
}

interface ClosingEntryPreview {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'REVENUE' | 'EXPENSE';
  currentBalance: number;
  amount: number;
}

interface ClosePreviewResult {
  entries: ClosingEntryPreview[];
  totalRevenue: number;
  totalExpenses: number;
  netSurplusOrDeficit: number;
  fundBalanceAccountName: string;
}

interface FiscalPeriodsPageClientProps {
  organizationSlug: string;
}

export function FiscalPeriodsPageClient({ organizationSlug }: FiscalPeriodsPageClientProps) {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [previewData, setPreviewData] = useState<ClosePreviewResult | null>(null);
  const [previewPeriodId, setPreviewPeriodId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationSlug}/fiscal-periods`);
      if (res.ok) {
        const data = await res.json();
        setPeriods(data);
      }
    } catch (e) {
      console.error('Failed to fetch fiscal periods:', e);
    } finally {
      setLoading(false);
    }
  }, [organizationSlug]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const handleCreate = async () => {
    if (!newName || !newStartDate || !newEndDate) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/organizations/${organizationSlug}/fiscal-periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          startDate: new Date(newStartDate).toISOString(),
          endDate: new Date(newEndDate).toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create fiscal period');
      }

      toast({ title: 'Fiscal period created', description: `"${newName}" has been created.` });
      setShowCreateDialog(false);
      setNewName('');
      setNewStartDate('');
      setNewEndDate('');
      fetchPeriods();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to create', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = async (periodId: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/fiscal-periods/${periodId}/preview`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to preview close');
      }
      const data = await res.json();
      setPreviewData(data);
      setPreviewPeriodId(periodId);
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Preview failed', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (!previewPeriodId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/fiscal-periods/${previewPeriodId}/close`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to close period');
      }
      const data = await res.json();
      toast({
        title: 'Fiscal period closed',
        description: `${data.entriesCreated} closing entries created. View them in Transactions using the "All Time" date range and "Closing" type filter.`,
      });
      setPreviewData(null);
      setPreviewPeriodId(null);
      fetchPeriods();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Close failed', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async (periodId: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/fiscal-periods/${periodId}/reopen`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reopen period');
      }
      toast({ title: 'Fiscal period reopened', description: 'All closing entries have been voided.' });
      fetchPeriods();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Reopen failed', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      OPEN: { variant: 'default', label: 'Open' },
      CLOSING: { variant: 'secondary', label: 'Closing' },
      CLOSED: { variant: 'outline', label: 'Closed' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Fiscal Periods
          </h1>
          <p className="mt-1 text-gray-500">
            Manage year-end closing entries to reset revenue and expense accounts.
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Fiscal Period
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Fiscal Period</DialogTitle>
              <DialogDescription>
                Define a new fiscal year period. At year-end, you&apos;ll close this period
                to zero out revenue and expense account balances.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="period-name">Period Name</Label>
                <Input
                  id="period-name"
                  placeholder='e.g., "FY 2025"'
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={isSubmitting || !newName || !newStartDate || !newEndDate}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Period
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Period List */}
      {periods.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Fiscal Periods</h3>
          <p className="text-gray-500 mt-1">
            Create your first fiscal period to begin tracking year-end closing.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.name}</TableCell>
                  <TableCell>{formatDate(period.startDate)}</TableCell>
                  <TableCell>{formatDate(period.endDate)}</TableCell>
                  <TableCell>{getStatusBadge(period.status)}</TableCell>
                  <TableCell>
                    {period.closedAt ? (
                      <span className="text-sm text-gray-500">{formatDate(period.closedAt)}</span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {period.status === 'OPEN' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(period.id)}
                          disabled={isSubmitting}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview Close
                        </Button>
                      )}
                      {period.status === 'CLOSED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReopen(period.id)}
                          disabled={isSubmitting}
                        >
                          <Unlock className="h-4 w-4 mr-1" />
                          Reopen
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Close Preview Dialog */}
      <Dialog open={!!previewData} onOpenChange={(open) => { if (!open) { setPreviewData(null); setPreviewPeriodId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Year-End Closing Preview
            </DialogTitle>
            <DialogDescription>
              Review the closing entries that will be generated. Revenue and expense account
              balances will be transferred to {previewData?.fundBalanceAccountName}.
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="space-y-6 py-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Total Revenue</p>
                  <p className="text-xl font-bold text-green-700">{formatCurrency(previewData.totalRevenue)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">Total Expenses</p>
                  <p className="text-xl font-bold text-red-700">{formatCurrency(previewData.totalExpenses)}</p>
                </div>
                <div className={`p-4 rounded-lg ${previewData.netSurplusOrDeficit >= 0 ? 'bg-blue-50' : 'bg-yellow-50'}`}>
                  <p className="text-sm font-medium" style={{ color: previewData.netSurplusOrDeficit >= 0 ? '#2563eb' : '#ca8a04' }}>
                    {previewData.netSurplusOrDeficit >= 0 ? 'Net Surplus' : 'Net Deficit'}
                  </p>
                  <p className="text-xl font-bold" style={{ color: previewData.netSurplusOrDeficit >= 0 ? '#1d4ed8' : '#a16207' }}>
                    {formatCurrency(Math.abs(previewData.netSurplusOrDeficit))}
                  </p>
                </div>
              </div>

              {/* Closing Entries Table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Closing Entries ({previewData.entries.length})
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Closing Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.entries.map((entry) => (
                      <TableRow key={entry.accountId}>
                        <TableCell>
                          <span className="text-gray-500 mr-1">{entry.accountCode}</span>
                          {entry.accountName}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.accountType === 'REVENUE' ? 'default' : 'destructive'}>
                            {entry.accountType === 'REVENUE' ? 'Revenue' : 'Expense'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(entry.currentBalance)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(entry.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold">This action will:</p>
                  <ul className="list-disc ml-4 mt-1 space-y-1">
                    <li>Create {previewData.entries.length} closing journal entries</li>
                    <li>Zero out all revenue and expense account balances</li>
                    <li>Transfer {formatCurrency(Math.abs(previewData.netSurplusOrDeficit))} to {previewData.fundBalanceAccountName}</li>
                    <li>Lock the fiscal period against new transactions</li>
                  </ul>
                  <p className="mt-2">This can be undone by reopening the period.</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPreviewData(null); setPreviewPeriodId(null); }}>
              Cancel
            </Button>
            <Button onClick={handleClose} disabled={isSubmitting} variant="destructive">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Lock className="h-4 w-4 mr-2" />
              Close Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
