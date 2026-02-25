'use client';

import { useEffect, useState, useCallback } from 'react';
import { Scale, Upload, FileText, CheckCircle, Clock, AlertCircle, Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatementUploadDialog } from './StatementUploadDialog';
import { ReconciliationWorkspace } from './ReconciliationWorkspace';
import { ReconciliationReports } from './ReconciliationReports';

interface BankAccountInfo {
  id: string;
  bankName: string;
  accountNumberLast4: string;
  accountType: string | null;
  accountName: string;
  accountCode: string;
}

interface StatementSummary {
  id: string;
  bankAccountId: string;
  statementDate: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: string;
  closingBalance: string;
  fileName: string;
  status: string;
  reconciledAt: string | null;
  _count: { lines: number };
  lineCounts: Record<string, number>;
}

interface ReconciliationPageClientProps {
  slug: string;
  bankAccounts: BankAccountInfo[];
}

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  IN_PROGRESS: { label: 'In Progress', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'outline' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

export function ReconciliationPageClient({ slug, bankAccounts }: ReconciliationPageClientProps) {
  const [selectedBankAccount, setSelectedBankAccount] = useState<string | null>(
    bankAccounts.length === 1 ? bankAccounts[0].id : null
  );
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [activeStatementId, setActiveStatementId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'statements' | 'reports'>('statements');

  const fetchStatements = useCallback(async (bankAccountId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/organizations/${slug}/bank-accounts/${bankAccountId}/statements`);
      if (res.ok) {
        const data = await res.json();
        setStatements(data);
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (selectedBankAccount) {
      fetchStatements(selectedBankAccount);
    }
  }, [selectedBankAccount, fetchStatements]);

  const selectedAccount = bankAccounts.find((ba) => ba.id === selectedBankAccount);

  // If viewing a reconciliation workspace, show that instead
  if (activeStatementId && selectedBankAccount) {
    return (
      <ReconciliationWorkspace
        slug={slug}
        bankAccountId={selectedBankAccount}
        statementId={activeStatementId}
        onBack={() => {
          setActiveStatementId(null);
          fetchStatements(selectedBankAccount);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" />
            Bank Reconciliation
          </h1>
          <p className="text-muted-foreground mt-1">
            Import bank statements and match them against your ledger
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('statements')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'statements'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Statements
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'reports'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Reports
        </button>
      </div>

      {/* Reports Tab */}
      {activeTab === 'reports' ? (
        <ReconciliationReports slug={slug} />
      ) : (
      <>
      {/* Bank Account Selection */}
      {bankAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No Bank Accounts Found</p>
            <p className="text-sm mt-1">
              Add a bank account in Settings to start reconciling.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bank Account Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bankAccounts.map((ba) => (
              <Card
                key={ba.id}
                className={`cursor-pointer transition-colors hover:border-primary ${
                  selectedBankAccount === ba.id ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => setSelectedBankAccount(ba.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{ba.bankName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {ba.accountName} ({ba.accountCode})
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ···{ba.accountNumberLast4} · {ba.accountType || 'Account'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Statements List */}
          {selectedBankAccount && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Statements — {selectedAccount?.bankName}
                </h2>
                <Button onClick={() => setShowUpload(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Statement
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : statements.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No statements imported yet.</p>
                    <p className="text-sm mt-1">
                      Download a CSV or OFX file from your bank and import it here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {statements.map((stmt) => {
                    const badge = STATUS_BADGES[stmt.status] || STATUS_BADGES.DRAFT;
                    const matched = (stmt.lineCounts?.MATCHED || 0) + (stmt.lineCounts?.CONFIRMED || 0);
                    const total = stmt._count.lines;
                    return (
                      <Card
                        key={stmt.id}
                        className="cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => setActiveStatementId(stmt.id)}
                      >
                        <CardContent className="flex items-center justify-between py-4">
                          <div className="flex items-center gap-4">
                            <div>
                              {stmt.status === 'COMPLETED' ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : stmt.status === 'IN_PROGRESS' ? (
                                <Clock className="h-5 w-5 text-blue-600" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{stmt.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(stmt.periodStart).toLocaleDateString()} — {new Date(stmt.periodEnd).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right text-sm">
                              <p>{matched}/{total} matched</p>
                            </div>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
      </>
      )}

      {/* Upload Dialog */}
      {showUpload && selectedBankAccount && (
        <StatementUploadDialog
          slug={slug}
          bankAccountId={selectedBankAccount}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            fetchStatements(selectedBankAccount);
          }}
        />
      )}
    </div>
  );
}
