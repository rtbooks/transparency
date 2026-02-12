/**
 * ChangeIndicator Component
 * Highlights what changed between two versions
 */

'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Plus, Minus, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

interface ChangeIndicatorProps {
  changes: Change[];
  title?: string;
  className?: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function getChangeType(from: unknown, to: unknown): 'added' | 'removed' | 'modified' {
  if (from === null || from === undefined) return 'added';
  if (to === null || to === undefined) return 'removed';
  return 'modified';
}

export function ChangeIndicator({
  changes,
  title = 'Changes',
  className,
}: ChangeIndicatorProps) {
  if (!changes || changes.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Edit className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {changes.map((change, index) => {
            const changeType = getChangeType(change.from, change.to);

            return (
              <div
                key={index}
                className={cn(
                  'rounded-lg border p-3 text-sm',
                  changeType === 'added' && 'border-green-200 bg-green-50',
                  changeType === 'removed' && 'border-red-200 bg-red-50',
                  changeType === 'modified' && 'border-blue-200 bg-blue-50'
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  {changeType === 'added' && (
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      <Plus className="mr-1 h-3 w-3" />
                      Added
                    </Badge>
                  )}
                  {changeType === 'removed' && (
                    <Badge variant="outline" className="bg-red-100 text-red-800">
                      <Minus className="mr-1 h-3 w-3" />
                      Removed
                    </Badge>
                  )}
                  {changeType === 'modified' && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                      <Edit className="mr-1 h-3 w-3" />
                      Modified
                    </Badge>
                  )}
                  <span className="font-medium">{change.field}</span>
                </div>
                
                <div className="flex items-center gap-2 pl-2">
                  {changeType !== 'added' && (
                    <span
                      className={cn(
                        'rounded px-2 py-1 font-mono text-xs',
                        changeType === 'removed'
                          ? 'bg-red-100 line-through'
                          : 'bg-gray-100'
                      )}
                    >
                      {formatValue(change.from)}
                    </span>
                  )}
                  
                  {changeType === 'modified' && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  
                  {changeType !== 'removed' && (
                    <span
                      className={cn(
                        'rounded px-2 py-1 font-mono text-xs',
                        changeType === 'added' ? 'bg-green-100' : 'bg-blue-100'
                      )}
                    >
                      {formatValue(change.to)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
