'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import { Clock, Copy, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  invitedBy: {
    name: string;
    email: string;
  };
  expiresAt: string;
  createdAt: string;
}

interface PendingInvitationsListProps {
  invitations: PendingInvitation[];
  organizationSlug: string;
  onInvitationRevoked: () => void;
}

export function PendingInvitationsList({
  invitations,
  organizationSlug,
  onInvitationRevoked,
}: PendingInvitationsListProps) {
  const { toast } = useToast();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: 'Link copied',
      description: 'Invitation link copied to clipboard',
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId);
    
    try {
      const response = await fetch(
        `/api/organizations/${organizationSlug}/invitations/${invitationId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to revoke invitation');
      }

      toast({
        title: 'Invitation revoked',
        description: 'The invitation has been successfully revoked',
      });

      onInvitationRevoked();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke invitation',
        variant: 'destructive',
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleResend = async (invitationId: string) => {
    try {
      const response = await fetch(
        `/api/organizations/${organizationSlug}/invitations/${invitationId}/resend`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to resend invitation');
      }

      toast({
        title: 'Invitation resent',
        description: 'A new invitation email has been sent',
      });

      onInvitationRevoked(); // Refresh the list
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resend invitation',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const hoursRemaining = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (hoursRemaining < 0) return 'Expired';
    if (hoursRemaining < 24) return `${hoursRemaining}h remaining`;
    const daysRemaining = Math.floor(hoursRemaining / 24);
    return `${daysRemaining}d remaining`;
  };

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pending Invitations</h2>
        <p className="text-sm text-gray-600 mt-1">
          Users who have been invited but haven't accepted yet
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Invited By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => {
              const expired = isExpired(invitation.expiresAt);
              return (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ROLE_LABELS[invitation.role as keyof typeof ROLE_LABELS]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {invitation.invitedBy.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span
                        className={`text-sm ${
                          expired ? 'text-red-600' : 'text-gray-600'
                        }`}
                      >
                        {getTimeRemaining(invitation.expiresAt)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyInviteLink(invitation.token)}
                        title="Copy invitation link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {expired ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResend(invitation.id)}
                          title="Resend invitation"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(invitation.id)}
                        disabled={revokingId === invitation.id}
                        title="Revoke invitation"
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
