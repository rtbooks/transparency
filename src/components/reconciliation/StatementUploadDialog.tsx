'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface StatementUploadDialogProps {
  slug: string;
  bankAccountId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function StatementUploadDialog({ slug, bankAccountId, onClose, onUploaded }: StatementUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);

    const text = await f.text();
    setFileContent(text);
  };

  const handleUpload = async () => {
    if (!file || !fileContent || !periodStart || !periodEnd) {
      setError('Please fill in all required fields and select a file.');
      return;
    }

    setUploading(true);
    setError(null);
    setWarnings([]);

    try {
      const res = await fetch(`/api/organizations/${slug}/bank-accounts/${bankAccountId}/statements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statementDate: periodEnd,
          periodStart,
          periodEnd,
          openingBalance: parseFloat(openingBalance) || 0,
          closingBalance: parseFloat(closingBalance) || 0,
          fileName: file.name,
          fileContent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to upload statement');
        if (data.warnings) setWarnings(data.warnings);
        return;
      }

      if (data.warnings?.length > 0) {
        setWarnings(data.warnings);
      }

      onUploaded();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Bank Statement
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or OFX/QFX file exported from your bank.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div>
            <Label>Statement File (CSV, OFX, QFX)</Label>
            <div className="mt-1">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.ofx,.qfx"
                onChange={handleFileChange}
              />
            </div>
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Period Start</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <Label>Period End</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Opening Balance</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
            <div>
              <Label>Closing Balance</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
              <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="text-sm bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-200 p-3 rounded-md space-y-1">
              <div className="flex items-center gap-1 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Parsing Warnings
              </div>
              {warnings.map((w, i) => (
                <p key={i} className="text-xs">{w}</p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import & Parse
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
