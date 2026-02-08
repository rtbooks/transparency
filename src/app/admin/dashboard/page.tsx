import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  DollarSign,
  Activity,
  TrendingUp,
} from 'lucide-react';

export default async function AdminDashboard() {
  // Fetch system-wide statistics
  const [
    totalOrganizations,
    totalUsers,
    totalTransactions,
    recentOrganizations,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.organization.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            organizationUsers: true,
            transactions: true,
          },
        },
      },
    }),
  ]);

  // Calculate total transaction value
  const transactionSum = await prisma.transaction.aggregate({
    _sum: {
      amount: true,
    },
  });

  const totalVolume = Number(transactionSum._sum.amount || 0);

  const stats = [
    {
      name: 'Total Organizations',
      value: totalOrganizations,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Total Users',
      value: totalUsers,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Total Transactions',
      value: totalTransactions,
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Transaction Volume',
      value: `$${totalVolume.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Platform Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Overview of all organizations and system metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="overflow-hidden rounded-lg bg-white shadow"
            >
              <div className="p-6">
                <div className="flex items-center">
                  <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      {stat.name}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Organizations */}
      <div className="rounded-lg bg-white shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Organizations
            </h2>
            <Link href="/admin/organizations">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentOrganizations.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No organizations yet
            </div>
          ) : (
            recentOrganizations.map((org) => (
              <div
                key={org.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    {org.name}
                  </h3>
                  <p className="text-sm text-gray-500">/{org.slug}</p>
                </div>
                <div className="flex items-center space-x-6 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Users className="mr-1 h-4 w-4" />
                    {org._count.organizationUsers} users
                  </div>
                  <div className="flex items-center">
                    <Activity className="mr-1 h-4 w-4" />
                    {org._count.transactions} transactions
                  </div>
                  <Link href={`/org/${org.slug}/dashboard`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/organizations/new">
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400 cursor-pointer transition-colors">
            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Create Organization
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Add a new organization to the platform
            </p>
          </div>
        </Link>

        <Link href="/admin/users">
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400 cursor-pointer transition-colors">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Manage Users
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              View and manage all platform users
            </p>
          </div>
        </Link>

        <Link href="/admin/analytics">
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400 cursor-pointer transition-colors">
            <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              View Analytics
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              System-wide metrics and reports
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
