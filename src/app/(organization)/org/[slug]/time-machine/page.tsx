/**
 * Time Machine Page
 * Browse historical states of organization data
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AsOfDatePicker } from '@/components/temporal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building, CreditCard, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import type { Organization, Account, ProgramSpending } from '@/generated/prisma/client';

interface TimeMachinePageProps {
  params: {
    slug: string;
  };
}

interface HistoricalState {
  asOfDate: string;
  organization: Organization & {
    versionMetadata: {
      versionId: string;
      validFrom: Date;
      validTo: Date;
    };
  };
  accounts: Array<Account & {
    versionMetadata: {
      versionId: string;
      validFrom: Date;
      validTo: Date;
    };
  }>;
  programSpending: Array<ProgramSpending & {
    versionMetadata: {
      versionId: string;
      validFrom: Date;
      validTo: Date;
    };
  }>;
}

export default function TimeMachinePage({ params }: TimeMachinePageProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [historicalData, setHistoricalData] = React.useState<HistoricalState | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchHistoricalData = React.useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);

    try {
      const dateStr = date.toISOString();
      const response = await fetch(`/api/organizations/${params.slug}/as-of/${dateStr}`);

      if (!response.ok) {
        throw new Error('Failed to fetch historical data');
      }

      const data = await response.json();
      setHistoricalData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setHistoricalData(null);
    } finally {
      setLoading(false);
    }
  }, [params.slug]);

  React.useEffect(() => {
    if (selectedDate) {
      fetchHistoricalData(selectedDate);
    } else {
      setHistoricalData(null);
    }
  }, [selectedDate, fetchHistoricalData]);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Time Machine</h1>
        <p className="text-muted-foreground">
          View your organization data as it existed at any point in time
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Select a Date</CardTitle>
        </CardHeader>
        <CardContent>
          <AsOfDatePicker
            date={selectedDate}
            onDateChange={setSelectedDate}
            maxDate={new Date()}
          />
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && historicalData && (
        <div className="space-y-6">
          {/* Viewing banner */}
          <Card className="border-primary bg-primary/5">
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="font-medium">
                  Viewing data as of {format(new Date(historicalData.asOfDate), 'PPP')}
                </p>
                <p className="text-sm text-muted-foreground">
                  This is a historical snapshot. Current data may differ.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push(`/org/${params.slug}`)}
              >
                View Current State
              </Button>
            </CardContent>
          </Card>

          {/* Organization Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{historicalData.organization.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge>{historicalData.organization.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">EIN</p>
                  <p className="font-medium">{historicalData.organization.ein || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription Tier</p>
                  <Badge variant="secondary">
                    {historicalData.organization.subscriptionTier}
                  </Badge>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Version Info</p>
                <p className="text-xs font-mono">
                  Valid from:{' '}
                  {format(
                    new Date(historicalData.organization.versionMetadata.validFrom),
                    'PPpp'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Chart of Accounts ({historicalData.accounts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historicalData.accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No accounts existed on this date
                </p>
              ) : (
                <div className="space-y-2">
                  {historicalData.accounts.map((account) => (
                    <div
                      key={account.versionId}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {account.code} - {account.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {account.type} • Balance: $
                          {Number(account.currentBalance).toFixed(2)}
                        </p>
                      </div>
                      <Badge variant={account.isActive ? 'default' : 'secondary'}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Program Spending */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Program Spending ({historicalData.programSpending.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historicalData.programSpending.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No program spending existed on this date
                </p>
              ) : (
                <div className="space-y-2">
                  {historicalData.programSpending.map((item) => (
                    <div
                      key={item.versionId}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Estimated: ${Number(item.estimatedAmount).toFixed(2)}
                        </p>
                      </div>
                      <Badge>{item.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedDate && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Select a date above to view historical data
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
