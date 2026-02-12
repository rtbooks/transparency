/**
 * VersionComparison Component
 * Side-by-side comparison of two versions
 */

'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VersionData {
  [key: string]: unknown;
  versionId?: string;
  validFrom?: Date | string;
  validTo?: Date | string;
}

interface VersionComparisonProps {
  leftVersion: VersionData;
  rightVersion: VersionData;
  leftLabel?: string;
  rightLabel?: string;
  excludeFields?: string[];
  className?: string;
}

const TEMPORAL_FIELDS = [
  'versionId',
  'previousVersionId',
  'validFrom',
  'validTo',
  'systemFrom',
  'systemTo',
  'isDeleted',
  'deletedAt',
  'deletedBy',
  'changedBy',
  'createdAt',
  'updatedAt',
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value instanceof Date) {
    return format(value, 'PPpp');
  }
  if (typeof value === 'string' && Date.parse(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return format(date, 'PPpp');
    }
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export function VersionComparison({
  leftVersion,
  rightVersion,
  leftLabel = 'Previous Version',
  rightLabel = 'Current Version',
  excludeFields = [],
  className,
}: VersionComparisonProps) {
  // Get all unique fields from both versions
  const allFields = Array.from(
    new Set([...Object.keys(leftVersion), ...Object.keys(rightVersion)])
  );

  // Filter out temporal and excluded fields
  const fieldsToCompare = allFields.filter(
    (field) =>
      !TEMPORAL_FIELDS.includes(field) &&
      !excludeFields.includes(field) &&
      field !== 'id' &&
      field !== 'organizationId'
  );

  // Determine which fields changed
  const changedFields = fieldsToCompare.filter(
    (field) =>
      JSON.stringify(leftVersion[field]) !== JSON.stringify(rightVersion[field])
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Version Comparison
          {changedFields.length > 0 && (
            <Badge variant="secondary">
              {changedFields.length} change{changedFields.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="grid grid-cols-[200px_1fr_auto_1fr] gap-4">
            {/* Header row */}
            <div className="font-semibold">Field</div>
            <div className="font-semibold">{leftLabel}</div>
            <div className="w-8" />
            <div className="font-semibold">{rightLabel}</div>

            {/* Data rows */}
            {fieldsToCompare.map((field) => {
              const leftValue = leftVersion[field];
              const rightValue = rightVersion[field];
              const hasChanged =
                JSON.stringify(leftValue) !== JSON.stringify(rightValue);

              return (
                <React.Fragment key={field}>
                  <div
                    className={cn(
                      'py-2 text-sm',
                      hasChanged && 'font-medium text-primary'
                    )}
                  >
                    {formatFieldName(field)}
                    {hasChanged && (
                      <CheckCircle className="ml-1 inline h-3 w-3 text-primary" />
                    )}
                  </div>

                  <div
                    className={cn(
                      'rounded border py-2 px-3 text-sm font-mono',
                      hasChanged
                        ? 'border-orange-200 bg-orange-50'
                        : 'border-border bg-muted/50'
                    )}
                  >
                    {formatValue(leftValue)}
                  </div>

                  <div className="flex items-center justify-center">
                    {hasChanged && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div
                    className={cn(
                      'rounded border py-2 px-3 text-sm font-mono',
                      hasChanged
                        ? 'border-green-200 bg-green-50 font-semibold'
                        : 'border-border bg-muted/50'
                    )}
                  >
                    {formatValue(rightValue)}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </ScrollArea>

        {changedFields.length === 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No changes detected between these versions
          </p>
        )}
      </CardContent>
    </Card>
  );
}
