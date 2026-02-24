'use client';

import { useState } from 'react';
import { Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import type { AttachmentItem } from '@/components/attachments/AttachmentList';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

interface ImageGalleryProps {
  attachments: AttachmentItem[];
  organizationSlug: string;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}

export function isImageAttachment(att: AttachmentItem): boolean {
  return IMAGE_MIME_TYPES.includes(att.mimeType);
}

export function ImageGallery({
  attachments,
  organizationSlug,
  onDelete,
  readOnly = false,
}: ImageGalleryProps) {
  const images = attachments.filter(isImageAttachment);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const getImageUrl = (att: AttachmentItem) =>
    `/api/organizations/${organizationSlug}/attachments/${att.id}/download`;

  const showPrev = () =>
    setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : images.length - 1));
  const showNext = () =>
    setLightboxIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : 0));

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((img, idx) => (
          <div
            key={img.id}
            className="group relative aspect-square overflow-hidden rounded-lg border bg-muted cursor-pointer"
            onClick={() => setLightboxIndex(idx)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageUrl(img)}
              alt={img.fileName}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            {!readOnly && onDelete && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(img.id);
                }}
                type="button"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="truncate text-xs text-white">{img.fileName}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
        <DialogContent className="max-w-4xl border-0 bg-black/90 p-0">
          {lightboxIndex !== null && (
            <div className="relative flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/20"
                onClick={showPrev}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getImageUrl(images[lightboxIndex])}
                alt={images[lightboxIndex].fileName}
                className="max-h-[80vh] max-w-full object-contain"
              />

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/20"
                onClick={showNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 z-10 text-white hover:bg-white/20"
                onClick={() => setLightboxIndex(null)}
              >
                <X className="h-5 w-5" />
              </Button>

              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-sm text-white/80">
                  {images[lightboxIndex].fileName} · {lightboxIndex + 1} of {images.length}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
