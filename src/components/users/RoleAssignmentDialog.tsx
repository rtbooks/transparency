'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, getAssignableRoles } from '@/lib/auth/permissions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface RoleAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
  organizationUserId: string;
  currentRole: UserRole;
  userName: string;
  currentUserRole: UserRole;
}

export function RoleAssignmentDialog({
  open,
  onOpenChange,
  organizationSlug,
  organizationUserId,
  currentRole,
  userName,
  currentUserRole,
}: RoleAssignmentDialogProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const assignableRoles = getAssignableRoles(currentUserRole);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedRole === currentRole) {
      toast({
        title: 'No changes made',
        description: 'The role is already set to this value.',
      });
      onOpenChange(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/organizations/${organizationSlug}/users/${organizationUserId}/role`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: selectedRole }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update role');
      }

      toast({
        title: 'Role updated',
        description: `${userName}'s role has been changed to ${ROLE_LABELS[selectedRole]}.`,
      });

      router.refresh();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Change Role for {userName}</DialogTitle>
            <DialogDescription>
              Select a new role for this user. Their permissions will be updated immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <RadioGroup value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
              <div className="space-y-4">
                {assignableRoles.map((role) => (
                  <div key={role} className="flex items-start space-x-3">
                    <RadioGroupItem value={role} id={role} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={role} className="text-base font-medium cursor-pointer">
                        {ROLE_LABELS[role]}
                      </Label>
                      <p className="text-sm text-gray-600 mt-1">
                        {ROLE_DESCRIPTIONS[role]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>

            {selectedRole === 'PLATFORM_ADMIN' && currentUserRole !== 'PLATFORM_ADMIN' && (
              <Alert className="mt-4" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You don't have permission to assign Platform Admin role.
                </AlertDescription>
              </Alert>
            )}
          </div>

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
              type="submit" 
              disabled={isLoading || selectedRole === currentRole}
            >
              {isLoading ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
