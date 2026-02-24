'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ProgramSpendingDetail } from './ProgramSpendingDetail';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Search, Target } from 'lucide-react';

interface SpendingItem {
  id: string;
  versionId: string;
  title: string;
  description: string;
  estimatedAmount: number;
  actualTotal: number;
  transactionCount: number;
  targetDate: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completedAt: string | null;
  createdAt: string;
}

interface Statistics {
  total: number;
  planned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  totalEstimated: number;
  totalActual: number;
}

interface ProgramSpendingListProps {
  organizationSlug: string;
  refreshKey: number;
  canEdit: boolean;
  openItemId: string | null;
  onItemOpened: () => void;
  onRefresh: () => void;
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export function ProgramSpendingList({
  organizationSlug,
  refreshKey,
  canEdit,
  openItemId,
  onItemOpened,
  onRefresh,
}: ProgramSpendingListProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<SpendingItem[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(
        `/api/organizations/${organizationSlug}/program-spending?${params}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setItems(data.items);
    } catch {
      toast({ title: 'Error', description: 'Failed to load program spending', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [organizationSlug, statusFilter, search, toast]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/program-spending/statistics`
      );
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // Stats are non-critical
    }
  }, [organizationSlug]);

  useEffect(() => {
    fetchItems();
    fetchStats();
  }, [fetchItems, fetchStats, refreshKey]);

  useEffect(() => {
    if (openItemId) {
      setSelectedId(openItemId);
      onItemOpened();
    }
  }, [openItemId, onItemOpened]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  const getProgress = (item: SpendingItem) => {
    if (item.estimatedAmount === 0) return 0;
    return Math.min(100, Math.round((item.actualTotal / item.estimatedAmount) * 100));
  };

  return (
    <>
      {/* Summary Cards */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Planned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.planned}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.totalEstimated)} estimated
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.totalActual)} spent
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search spending items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No spending items</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {statusFilter !== 'ALL'
                  ? 'No items match the current filter.'
                  : 'Create your first program spending item to get started.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Estimated</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.versionId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedId(item.id)}
                  >
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PRIORITY_COLORS[item.priority]}>
                        {item.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.estimatedAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.actualTotal)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${getProgress(item)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {getProgress(item)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(item.targetDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[item.status]}>
                        {item.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selectedId && (
            <ProgramSpendingDetail
              organizationSlug={organizationSlug}
              itemId={selectedId}
              canEdit={canEdit}
              onClose={() => setSelectedId(null)}
              onUpdated={() => {
                onRefresh();
                fetchItems();
                fetchStats();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
