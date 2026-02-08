'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AVAILABLE_TEMPLATES } from '@/lib/templates/account-templates';
import { Loader2, FileText, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApplyTemplateDialogProps {
  organizationSlug: string;
  hasExistingAccounts: boolean;
  onSuccess?: () => void;
}

export function ApplyTemplateDialog({
  organizationSlug,
  hasExistingAccounts,
  onSuccess,
}: ApplyTemplateDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    setIsApplying(true);
    try {
      const response = await fetch(
        `/api/organizations/${organizationSlug}/accounts/apply-template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: selectedTemplate }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to apply template');
      }

      const result = await response.json();

      toast({
        title: 'Template Applied Successfully',
        description: result.message,
      });

      setIsOpen(false);
      router.refresh();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error applying template:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to apply template',
      });
    } finally {
      setIsApplying(false);
    }
  };

  if (hasExistingAccounts) {
    return null; // Don't show button if accounts already exist
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Apply Account Template</DialogTitle>
          <DialogDescription>
            Choose a pre-built chart of accounts template to quickly set up your
            organization. Templates can only be applied to organizations without
            existing accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {AVAILABLE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={`w-full rounded-lg border-2 p-4 text-left transition-all hover:border-blue-500 ${
                selectedTemplate === template.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
              disabled={isApplying}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {template.name}
                    </h3>
                    {selectedTemplate === template.id && (
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {template.description}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span className="font-medium">
                      {template.accountCount} accounts
                    </span>
                    <span>•</span>
                    <span>Suitable for: {template.suitable.join(', ')}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApplyTemplate}
            disabled={!selectedTemplate || isApplying}
          >
            {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
