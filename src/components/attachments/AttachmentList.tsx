'use client';

import { Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFileIcon, formatFileSize } from './FileUploadZone';

export interface AttachmentItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  blobUrl: string;
  uploadedAt: string;
}

interface AttachmentListProps {
  attachments: AttachmentItem[];
  onDelete?: (id: string) => void;
  deleting?: string | null;
  readOnly?: boolean;
}

export function AttachmentList({
  attachments,
  onDelete,
  deleting,
  readOnly = false,
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No attachments yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {attachments.map((att) => {
        const Icon = getFileIcon(att.mimeType);
        const isDeleting = deleting === att.id;

        return (
          <li
            key={att.id}
            className="flex items-center gap-3 rounded-md border p-2 text-sm"
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{att.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(att.fileSize)}
              </p>
            </div>
            <a
              href={att.blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button variant="ghost" size="icon" className="h-7 w-7" type="button">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
            {!readOnly && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(att.id)}
                disabled={isDeleting}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
