/**
 * Audit Trail Client Component
 * Interactive audit trail with filtering
 */

'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, User, Database, CreditCard, Search } from 'lucide-react';
import type { Organization, Account } from '@/generated/prisma/client';

interface AuditEntry {
  id: string;
  timestamp: Date;
  entityType: 'organization' | 'account';
  entityId: string;
  entityName: string;
  action: string;
  changedBy?: string;
  changes?: Record<string, unknown>;
}

interface AuditTrailClientProps {
  organization: Organization;
  orgHistory: Organization[];
  accountsHistory: Account[];
}

export function AuditTrailClient({
  organization,
  orgHistory,
  accountsHistory,
}: AuditTrailClientProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterType, setFilterType] = React.useState<'all' | 'organization' | 'account'>('all');

  // Combine and sort all audit entries
  const allEntries = React.useMemo(() => {
    const entries: AuditEntry[] = [];

    // Organization changes
    orgHistory.forEach((version, index) => {
      const previous = orgHistory[index + 1];
      entries.push({
        id: version.versionId,
        timestamp: new Date(version.systemFrom),
        entityType: 'organization',
        entityId: version.id,
        entityName: version.name,
        action: index === orgHistory.length - 1 ? 'Created' : 'Updated',
        changedBy: version.changedBy || undefined,
      });
    });

    // Account changes
    accountsHistory.forEach((version) => {
      entries.push({
        id: version.versionId,
        timestamp: new Date(version.systemFrom),
        entityType: 'account',
        entityId: version.id,
        entityName: `${version.code} - ${version.name}`,
        action: version.isDeleted ? 'Deleted' : 'Updated',
        changedBy: version.changedBy || undefined,
      });
    });

    // Sort by timestamp descending (most recent first)
    return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [orgHistory, accountsHistory]);

  // Filter entries
  const filteredEntries = React.useMemo(() => {
    return allEntries.filter((entry) => {
      // Filter by type
      if (filterType !== 'all' && entry.entityType !== filterType) {
        return false;
      }

      // Filter by search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          entry.entityName.toLowerCase().includes(search) ||
          entry.action.toLowerCase().includes(search) ||
          entry.changedBy?.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [allEntries, filterType, searchTerm]);

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'organization':
        return <Database className="h-4 w-4" />;
      case 'account':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' => {
    if (action === 'Created') return 'default';
    if (action === 'Deleted') return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by entity name, action, or user..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={(value: typeof filterType) => setFilterType(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="account">Accounts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allEntries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Organization Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allEntries.filter((e) => e.entityType === 'organization').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Account Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allEntries.filter((e) => e.entityType === 'account').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Change Log ({filteredEntries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 rounded-lg border p-4 hover:bg-muted/50"
                >
                  <div className="rounded-full bg-muted p-2">
                    {getEntityIcon(entry.entityType)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getActionBadgeVariant(entry.action)}>
                        {entry.action}
                      </Badge>
                      <span className="font-medium">{entry.entityName}</span>
                      <span className="text-sm text-muted-foreground">
                        ({entry.entityType})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(entry.timestamp, 'PPpp')}
                      </span>
                      {entry.changedBy && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {entry.changedBy}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filteredEntries.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  No changes found matching your filters
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
