'use client';

import { useCallback, useState } from 'react';
import { Upload, X, FileText, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];
const MAX_SIZE = 250 * 1024; // 250 KB

interface FileUploadZoneProps {
  onFileSelected: (file: File) => void;
  uploading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FileUploadZone({
  onFileSelected,
  uploading = false,
  disabled = false,
  className,
}: FileUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('Only PDF, PNG, JPG, and WEBP files are allowed.');
        return;
      }

      if (file.size > MAX_SIZE) {
        setError(`File is too large (${(file.size / 1024).toFixed(0)} KB). Maximum is 250 KB.`);
        return;
      }

      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (disabled || uploading) return;

      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [disabled, uploading, validateAndSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
      e.target.value = '';
    },
    [validateAndSelect]
  );

  return (
    <div className={className}>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors',
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          (disabled || uploading) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          {uploading ? (
            'Uploading...'
          ) : (
            <>
              <span className="font-medium text-foreground">Click to upload</span> or drag and
              drop
            </>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          PDF, PNG, JPG, WEBP up to 250 KB
        </div>
        <input
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={handleChange}
          disabled={disabled || uploading}
        />
      </label>
      {error && (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────

export function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  return FileText;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
