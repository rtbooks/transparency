'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RemoveUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
  organizationUserId: string;
  userName: string;
}

export function RemoveUserDialog({
  open,
  onOpenChange,
  organizationSlug,
  organizationUserId,
  userName,
}: RemoveUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleRemove = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/organizations/${organizationSlug}/users/${organizationUserId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove user');
      }

      toast({
        title: 'User removed',
        description: `${userName} has been removed from the organization.`,
      });

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove user',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Remove {userName}?</DialogTitle>
          <DialogDescription>
            This will remove {userName} from the organization. They will no longer have access
            to any organization data or settings.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This action cannot be undone. The user will need to be re-invited to regain access.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleRemove}
            disabled={isLoading}
          >
            {isLoading ? 'Removing...' : 'Remove User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
