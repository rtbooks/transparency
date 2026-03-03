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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploadResult, setUploadResult] = useState<{ linesImported: number; duplicatesSkipped: number; totalParsed: number } | null>(null);
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
    if (!file || !fileContent) {
      setError('Please select a file.');
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

      // Show dedup results if there were duplicates
      if (data.duplicatesSkipped > 0) {
        setUploadResult({
          linesImported: data.linesImported ?? data.lineCount ?? 0,
          duplicatesSkipped: data.duplicatesSkipped,
          totalParsed: data.totalParsed ?? 0,
        });
        return; // Stay open to show the summary
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
            Import Bank Transactions
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or OFX/QFX file exported from your bank. Duplicate transactions will be automatically skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div>
            <Label>Transaction File (CSV, OFX, QFX)</Label>
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

          {/* Dedup Results */}
          {uploadResult && (
            <div className="text-sm bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200 p-3 rounded-md space-y-1">
              <p className="font-medium">Import Complete</p>
              <p>{uploadResult.linesImported} new transactions imported</p>
              <p>{uploadResult.duplicatesSkipped} duplicate{uploadResult.duplicatesSkipped !== 1 ? 's' : ''} skipped</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {uploadResult ? (
            <Button onClick={onUploaded}>Done</Button>
          ) : (
            <>
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
