'use client';

import { useState } from 'react';
import { UserList } from '@/components/users/UserList';
import { InviteUserDialog } from '@/components/users/InviteUserDialog';
import { PendingInvitationsList } from '@/components/users/PendingInvitationsList';
import { Button } from '@/components/ui/button';
import { UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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

interface UsersPageClientProps {
  slug: string;
  organizationName: string;
  users: any[];
  organizationId: string;
  canManageUsers: boolean;
  currentUserRole: string;
  pendingInvitations: PendingInvitation[];
}

export function UsersPageClient({
  slug,
  organizationName,
  users,
  organizationId,
  canManageUsers,
  currentUserRole,
  pendingInvitations,
}: UsersPageClientProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const handleInviteSuccess = () => {
    // Refresh the page to show updated user list
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href={`/org/${slug}/dashboard`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {organizationName} - User Management
            </h1>
            <p className="mt-2 text-gray-600">
              Manage users and their roles within your organization
            </p>
          </div>
          {canManageUsers && (
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          )}
        </div>

        {canManageUsers && pendingInvitations.length > 0 && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <PendingInvitationsList
              invitations={pendingInvitations}
              organizationSlug={slug}
              onInvitationRevoked={handleInviteSuccess}
            />
          </div>
        )}

        <div className="rounded-lg bg-white p-6 shadow">
          <UserList
            organizationId={organizationId}
            organizationSlug={slug}
            users={users}
            currentUserRole={currentUserRole as any}
          />
        </div>
      </div>

      {canManageUsers && (
        <InviteUserDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          organizationSlug={slug}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  );
}
