'use client';

import { useState } from 'react';
import { UserRole, OrganizationUser } from '@/generated/prisma/client';
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
import { RoleAssignmentDialog } from './RoleAssignmentDialog';
import { RemoveUserDialog } from './RemoveUserDialog';
import { UserPlus } from 'lucide-react';

// Serialized user type with Decimal converted to number
interface SerializedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  authId: string;
  totalDonated: number; // Converted from Decimal
  createdAt: Date;
  updatedAt: Date;
}

interface OrganizationUserWithUser extends OrganizationUser {
  user: SerializedUser;
}

interface UserListProps {
  organizationId: string;
  organizationSlug: string;
  users: OrganizationUserWithUser[];
  currentUserRole: UserRole;
}

export function UserList({
  organizationId,
  organizationSlug,
  users,
  currentUserRole,
}: UserListProps) {
  const [selectedUser, setSelectedUser] = useState<OrganizationUserWithUser | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'ORG_ADMIN':
        return 'bg-blue-100 text-blue-800';
      case 'SUPPORTER':
        return 'bg-green-100 text-green-800';
      case 'PUBLIC':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canManageUser = (userRole: UserRole) => {
    // Platform admins can manage anyone
    if (currentUserRole === 'PLATFORM_ADMIN') return true;
    
    // Org admins can manage supporters and other org admins (but not platform admins)
    if (currentUserRole === 'ORG_ADMIN' && userRole !== 'PLATFORM_ADMIN') return true;
    
    return false;
  };

  const handleChangeRole = (user: OrganizationUserWithUser) => {
    setSelectedUser(user);
    setIsRoleDialogOpen(true);
  };

  const handleRemoveUser = (user: OrganizationUserWithUser) => {
    setSelectedUser(user);
    setIsRemoveDialogOpen(true);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Team Members</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage who has access to your organization
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  No team members found
                </TableCell>
              </TableRow>
            ) : (
              users.map((orgUser) => (
                <TableRow key={orgUser.id}>
                  <TableCell className="font-medium">
                    {orgUser.user.name}
                  </TableCell>
                  <TableCell>{orgUser.user.email}</TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(orgUser.role)}>
                      {ROLE_LABELS[orgUser.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(orgUser.joinedAt)}</TableCell>
                  <TableCell className="text-right">
                    {canManageUser(orgUser.role) ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleChangeRole(orgUser)}
                        >
                          Change Role
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveUser(orgUser)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedUser && (
        <>
          <RoleAssignmentDialog
            open={isRoleDialogOpen}
            onOpenChange={setIsRoleDialogOpen}
            organizationSlug={organizationSlug}
            organizationUserId={selectedUser.id}
            currentRole={selectedUser.role}
            userName={selectedUser.user.name}
            currentUserRole={currentUserRole}
          />
          <RemoveUserDialog
            open={isRemoveDialogOpen}
            onOpenChange={setIsRemoveDialogOpen}
            organizationSlug={organizationSlug}
            organizationUserId={selectedUser.id}
            userName={selectedUser.user.name}
          />
        </>
      )}
    </div>
  );
}
