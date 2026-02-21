import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users as UsersIcon, Building2 } from 'lucide-react';

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Fetch organization memberships separately (bitemporal)
  const userIds = users.map(u => u.id);
  const orgUsers = userIds.length > 0
    ? await prisma.organizationUser.findMany({
        where: buildCurrentVersionWhere({ userId: { in: userIds } }),
      })
    : [];

  // Fetch organizations for those memberships
  const orgIds = [...new Set(orgUsers.map(ou => ou.organizationId))];
  const organizations = orgIds.length > 0
    ? await prisma.organization.findMany({
        where: buildCurrentVersionWhere({ id: { in: orgIds } }),
        select: { id: true, name: true, slug: true },
      })
    : [];
  const orgMap = new Map(organizations.map(o => [o.id, { name: o.name, slug: o.slug }]));

  // Build enriched users with organizations
  const usersWithOrgs = users.map(user => ({
    ...user,
    organizations: orgUsers
      .filter(ou => ou.userId === user.id)
      .map(ou => ({
        ...ou,
        organization: orgMap.get(ou.organizationId) || { name: 'Unknown', slug: '' },
      })),
  }));

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ORG_ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DONOR':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
        return 'Platform Admin';
      case 'ORG_ADMIN':
        return 'Org Admin';
      case 'DONOR':
        return 'Donor';
      default:
        return role;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          View and manage all platform users and their organization memberships
        </p>
      </div>

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{usersWithOrgs.length}</p>
            </div>
            <UsersIcon className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Platform Admins</p>
              <p className="text-2xl font-bold text-gray-900">
                {
                  usersWithOrgs.filter((u) =>
                    u.organizations.some((o) => o.role === 'PLATFORM_ADMIN')
                  ).length
                }
              </p>
            </div>
            <UsersIcon className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Org Admins</p>
              <p className="text-2xl font-bold text-gray-900">
                {
                  usersWithOrgs.filter((u) =>
                    u.organizations.some((o) => o.role === 'ORG_ADMIN')
                  ).length
                }
              </p>
            </div>
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg bg-white shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Organizations</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-gray-500">
                  <UsersIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium">No users yet</p>
                </TableCell>
              </TableRow>
            ) : (
              usersWithOrgs.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      {user.organizations.some((o) => o.role === 'PLATFORM_ADMIN') && (
                        <Badge
                          variant="outline"
                          className="mt-1 bg-purple-50 text-purple-700 border-purple-200"
                        >
                          Platform Admin
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">{user.email}</span>
                  </TableCell>
                  <TableCell>
                    {user.organizations.length === 0 ? (
                      <span className="text-sm text-gray-400">None</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {user.organizations.map((orgUser) => (
                          <div
                            key={orgUser.organizationId}
                            className="flex items-center gap-2"
                          >
                            <span className="text-sm text-gray-900">
                              {orgUser.organization.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={getRoleBadgeColor(orgUser.role)}
                            >
                              {getRoleLabel(orgUser.role)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {formatDate(user.createdAt)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

