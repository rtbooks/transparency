import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Activity, Plus } from 'lucide-react';

export default async function OrganizationsListPage() {
  const organizations = await prisma.organization.findMany({
    where: buildCurrentVersionWhere({}),
    orderBy: { createdAt: 'desc' },
  });

  // Fetch counts separately since relations are removed
  const orgIds = organizations.map(org => org.id);
  const [orgUserCounts, transactionCounts, accountCounts] = orgIds.length > 0
    ? await Promise.all([
        prisma.organizationUser.groupBy({
          by: ['organizationId'],
          where: buildCurrentVersionWhere({ organizationId: { in: orgIds } }),
          _count: true,
        }),
        prisma.transaction.groupBy({
          by: ['organizationId'],
          where: buildCurrentVersionWhere({ organizationId: { in: orgIds } }),
          _count: true,
        }),
        prisma.account.groupBy({
          by: ['organizationId'],
          where: buildCurrentVersionWhere({ organizationId: { in: orgIds } }),
          _count: true,
        }),
      ])
    : [[], [], []];

  const orgUserCountMap = new Map(orgUserCounts.map(c => [c.organizationId, c._count]));
  const txCountMap = new Map(transactionCounts.map(c => [c.organizationId, c._count]));
  const acctCountMap = new Map(accountCounts.map(c => [c.organizationId, c._count]));

  const orgsWithCounts = organizations.map(org => ({
    ...org,
    _count: {
      organizationUsers: orgUserCountMap.get(org.id) || 0,
      transactions: txCountMap.get(org.id) || 0,
      accounts: acctCountMap.get(org.id) || 0,
    },
  }));

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage all organizations on the platform
          </p>
        </div>
        <Link href="/admin/organizations/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Organization
          </Button>
        </Link>
      </div>

      <div className="rounded-lg bg-white shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>EIN</TableHead>
              <TableHead className="text-center">Users</TableHead>
              <TableHead className="text-center">Accounts</TableHead>
              <TableHead className="text-center">Transactions</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium">No organizations yet</p>
                  <p className="text-sm mt-1">
                    Get started by creating your first organization
                  </p>
                  <Link href="/admin/organizations/new">
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Organization
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              orgsWithCounts.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">{org.name}</div>
                      {org.mission && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {org.mission}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">/{org.slug}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {org.ein || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      <Users className="mr-1 h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">
                        {org._count.organizationUsers}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium">
                      {org._count.accounts}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      <Activity className="mr-1 h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">
                        {org._count.transactions}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {formatDate(org.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/org/${org.slug}/dashboard`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                      <Link href={`/org/${org.slug}/settings`}>
                        <Button variant="outline" size="sm">
                          Settings
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Stats */}
      {orgsWithCounts.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Organizations</p>
                <p className="text-2xl font-bold text-gray-900">
                  {orgsWithCounts.length}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {orgsWithCounts.reduce((sum, org) => sum + org._count.organizationUsers, 0)}
                </p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {orgsWithCounts.reduce((sum, org) => sum + org._count.transactions, 0)}
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
