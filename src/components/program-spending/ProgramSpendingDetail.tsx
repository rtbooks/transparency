'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { LinkTransactionDialog } from './LinkTransactionDialog';
import { AttachmentSection } from '@/components/attachments/AttachmentSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowRight,
  Edit2,
  Link2,
  Trash2,
  X,
} from 'lucide-react';

interface LinkedTransaction {
  linkId: string;
  transactionId: string;
  amount: number;
  linkedAt: string;
  transaction: {
    id: string;
    description: string;
    amount: number;
    transactionDate: string;
    type: string;
  } | null;
}

interface SpendingDetail {
  id: string;
  versionId: string;
  title: string;
  description: string;
  estimatedAmount: number;
  actualTotal: number;
  targetDate: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completedAt: string | null;
  createdAt: string;
  linkedTransactions: LinkedTransaction[];
}

interface ProgramSpendingDetailProps {
  organizationSlug: string;
  itemId: string;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export function ProgramSpendingDetail({
  organizationSlug,
  itemId,
  canEdit,
  onClose,
  onUpdated,
}: ProgramSpendingDetailProps) {
  const { toast } = useToast();
  const [item, setItem] = useState<SpendingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editPriority, setEditPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');

  const fetchItem = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/organizations/${organizationSlug}/program-spending/${itemId}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setItem(data);
      setEditTitle(data.title);
      setEditDescription(data.description);
      setEditAmount(data.estimatedAmount.toString());
      setEditTargetDate(data.targetDate ? data.targetDate.split('T')[0] : '');
      setEditPriority(data.priority);
    } catch {
      toast({ title: 'Error', description: 'Failed to load details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [organizationSlug, itemId, toast]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const handleStatusChange = async (newStatus: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(
        `/api/organizations/${organizationSlug}/program-spending/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) throw new Error('Failed to update');
      toast({ title: 'Updated', description: `Status changed to ${newStatus.replace('_', ' ')}` });
      await fetchItem();
      onUpdated();
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(
        `/api/organizations/${organizationSlug}/program-spending/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editTitle.trim(),
            description: editDescription.trim(),
            estimatedAmount: parseFloat(editAmount),
            targetDate: editTargetDate || null,
            priority: editPriority,
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to update');
      toast({ title: 'Saved', description: 'Changes saved successfully' });
      setEditing(false);
      await fetchItem();
      onUpdated();
    } catch {
      toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlink = async (transactionId: string) => {
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/program-spending/${itemId}/transactions/${transactionId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to unlink');
      toast({ title: 'Unlinked', description: 'Transaction unlinked' });
      await fetchItem();
      onUpdated();
    } catch {
      toast({ title: 'Error', description: 'Failed to unlink transaction', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      setActionLoading(true);
      const res = await fetch(
        `/api/organizations/${organizationSlug}/program-spending/${itemId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete');
      toast({ title: 'Deleted', description: 'Item deleted' });
      onClose();
      onUpdated();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !item) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const progress = item.estimatedAmount > 0
    ? Math.min(100, Math.round((item.actualTotal / item.estimatedAmount) * 100))
    : 0;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <div className="flex items-center justify-between">
          <div>
            <DialogTitle className="text-xl">{item.title}</DialogTitle>
            <DialogDescription className="mt-1">
              Created {new Date(item.createdAt).toLocaleDateString()}
            </DialogDescription>
          </div>
          <Badge variant="outline" className={STATUS_COLORS[item.status]}>
            {item.status.replace('_', ' ')}
          </Badge>
        </div>
      </DialogHeader>

      {/* Edit Mode */}
      {editing ? (
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea id="edit-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-amount">Estimated Amount</Label>
              <Input id="edit-amount" type="number" min="0.01" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-date">Target Date</Label>
              <Input id="edit-date" type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={editPriority} onValueChange={(v) => setEditPriority(v as 'HIGH' | 'MEDIUM' | 'LOW')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* View Mode */}
          <div className="space-y-3">
            {item.description && (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Estimated:</span>{' '}
                {formatCurrency(item.estimatedAmount)}
              </div>
              <div>
                <span className="font-medium">Actual:</span>{' '}
                {formatCurrency(item.actualTotal)}
              </div>
              <div>
                <span className="font-medium">Target Date:</span>{' '}
                {item.targetDate ? new Date(item.targetDate).toLocaleDateString() : '—'}
              </div>
              <div>
                <span className="font-medium">Priority:</span> {item.priority}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Funding Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {canEdit && item.status !== 'CANCELLED' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit2 className="mr-1 h-3 w-3" /> Edit
              </Button>
              {item.status === 'PLANNED' && (
                <Button size="sm" onClick={() => handleStatusChange('IN_PROGRESS')} disabled={actionLoading}>
                  <ArrowRight className="mr-1 h-3 w-3" /> Start
                </Button>
              )}
              {(item.status === 'PLANNED' || item.status === 'IN_PROGRESS') && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => handleStatusChange('COMPLETED')} disabled={actionLoading}>
                    Complete
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange('CANCELLED')} disabled={actionLoading}>
                    <X className="mr-1 h-3 w-3" /> Cancel
                  </Button>
                </>
              )}
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={actionLoading}>
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            </div>
          )}
        </>
      )}

      {/* Linked Transactions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Linked Transactions ({item.linkedTransactions.length})</h3>
          {canEdit && item.status !== 'CANCELLED' && item.status !== 'COMPLETED' && (
            <Button variant="outline" size="sm" onClick={() => setShowLinkDialog(true)}>
              <Link2 className="mr-1 h-3 w-3" /> Link Transaction
            </Button>
          )}
        </div>

        {item.linkedTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions linked yet.</p>
        ) : (
          <div className="space-y-2">
            {item.linkedTransactions.map((link) => (
              <div
                key={link.linkId}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {link.transaction?.description || 'Unknown transaction'}
                  </p>
                  <p className="text-muted-foreground">
                    {link.transaction ? new Date(link.transaction.transactionDate).toLocaleDateString() : ''}{' '}
                    · {formatCurrency(link.amount)}
                  </p>
                </div>
                {canEdit && item.status !== 'CANCELLED' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnlink(link.transactionId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="space-y-3">
        <h3 className="font-medium">Attachments</h3>
        <AttachmentSection
          organizationSlug={organizationSlug}
          entityType="PROGRAM_SPENDING"
          entityId={itemId}
          readOnly={!canEdit}
        />
      </div>

      {/* Link Transaction Dialog */}
      {showLinkDialog && (
        <LinkTransactionDialog
          organizationSlug={organizationSlug}
          open={showLinkDialog}
          onOpenChange={setShowLinkDialog}
          onLinked={async () => {
            setShowLinkDialog(false);
            await fetchItem();
            onUpdated();
          }}
          spendingItemId={itemId}
          existingTransactionIds={item.linkedTransactions.map((l) => l.transactionId)}
        />
      )}
    </div>
  );
}
