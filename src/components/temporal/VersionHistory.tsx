/**
 * VersionHistory Component
 * Displays a timeline of all versions of an entity
 */

'use client';

import * as React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, User, Trash2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VersionMetadata {
  versionId: string;
  previousVersionId: string | null;
  validFrom: Date | string;
  validTo: Date | string;
  systemFrom: Date | string;
  systemTo: Date | string;
  isDeleted: boolean;
  deletedAt?: Date | string | null;
  changedBy?: string | null;
}

export interface VersionHistoryItem<T = unknown> {
  data: T;
  versionMetadata: VersionMetadata;
  changes?: Record<string, { from: unknown; to: unknown }>;
}

interface VersionHistoryProps<T> {
  versions: VersionHistoryItem<T>[];
  renderVersion: (item: VersionHistoryItem<T>, index: number) => React.ReactNode;
  title?: string;
  emptyMessage?: string;
  className?: string;
}

export function VersionHistory<T>({
  versions,
  renderVersion,
  title = 'Version History',
  emptyMessage = 'No version history available',
  className,
}: VersionHistoryProps<T>) {
  if (!versions || versions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {versions.length} version{versions.length !== 1 ? 's' : ''} recorded
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {versions.map((version, index) => {
              const validFrom = new Date(version.versionMetadata.validFrom);
              const validTo = new Date(version.versionMetadata.validTo);
              const isCurrent = validTo.getFullYear() === 9999;
              const isDeleted = version.versionMetadata.isDeleted;

              return (
                <div
                  key={version.versionMetadata.versionId}
                  className={cn(
                    'relative border-l-2 pl-6 pb-4',
                    isCurrent && !isDeleted
                      ? 'border-primary'
                      : isDeleted
                      ? 'border-destructive'
                      : 'border-muted'
                  )}
                >
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'absolute left-[-9px] top-0 h-4 w-4 rounded-full border-2 bg-background',
                      isCurrent && !isDeleted
                        ? 'border-primary bg-primary'
                        : isDeleted
                        ? 'border-destructive'
                        : 'border-muted'
                    )}
                  />

                  {/* Version header */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {format(validFrom, 'PPpp')}
                      </span>
                      {isCurrent && !isDeleted && (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Current
                        </Badge>
                      )}
                      {isDeleted && (
                        <Badge variant="destructive" className="text-xs">
                          <Trash2 className="mr-1 h-3 w-3" />
                          Deleted
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(validFrom, { addSuffix: true })}
                    </span>
                  </div>

                  {/* Changed by */}
                  {version.versionMetadata.changedBy && (
                    <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      Changed by: {version.versionMetadata.changedBy}
                    </div>
                  )}

                  {/* Changes summary */}
                  {version.changes && Object.keys(version.changes).length > 0 && (
                    <div className="mb-2 text-xs">
                      <span className="font-medium">Changed fields:</span>{' '}
                      {Object.keys(version.changes).join(', ')}
                    </div>
                  )}

                  {/* Custom version rendering */}
                  <div className="mt-2">{renderVersion(version, index)}</div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
