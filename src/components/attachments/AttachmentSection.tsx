'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FileUploadZone } from './FileUploadZone';
import { AttachmentList, type AttachmentItem } from './AttachmentList';

interface AttachmentSectionProps {
  organizationSlug: string;
  entityType: 'TRANSACTION' | 'BILL' | 'PROGRAM_SPENDING';
  entityId: string;
  readOnly?: boolean;
}

export function AttachmentSection({
  organizationSlug,
  entityType,
  entityId,
  readOnly = false,
}: AttachmentSectionProps) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/attachments?entityType=${entityType}&entityId=${entityId}`
      );
      if (!res.ok) throw new Error('Failed to load attachments');
      const data = await res.json();
      setAttachments(data.attachments ?? []);
    } catch {
      toast({ title: 'Error', description: 'Could not load attachments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [organizationSlug, entityType, entityId, toast]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', entityType);
        formData.append('entityId', entityId);

        const res = await fetch(
          `/api/organizations/${organizationSlug}/attachments`,
          { method: 'POST', body: formData }
        );

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Upload failed');
        }

        const newAttachment = await res.json();
        setAttachments((prev) => [newAttachment, ...prev]);
        toast({ title: 'Uploaded', description: file.name });
      } catch (error) {
        toast({
          title: 'Upload failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setUploading(false);
      }
    },
    [organizationSlug, entityType, entityId, toast]
  );

  const handleDelete = useCallback(
    async (attachmentId: string) => {
      setDeleting(attachmentId);
      try {
        const res = await fetch(
          `/api/organizations/${organizationSlug}/attachments/${attachmentId}`,
          { method: 'DELETE' }
        );

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Delete failed');
        }

        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
        toast({ title: 'Deleted', description: 'Attachment removed' });
      } catch (error) {
        toast({
          title: 'Delete failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setDeleting(null);
      }
    },
    [organizationSlug, toast]
  );

  if (loading) {
    return <p className="text-sm text-muted-foreground py-2">Loading attachments...</p>;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Attachments</h4>
      <AttachmentList
        attachments={attachments}
        organizationSlug={organizationSlug}
        onDelete={readOnly ? undefined : handleDelete}
        deleting={deleting}
        readOnly={readOnly}
      />
      {!readOnly && (
        <FileUploadZone
          onFileSelected={handleUpload}
          uploading={uploading}
          disabled={attachments.length >= 10}
        />
      )}
    </div>
  );
}
