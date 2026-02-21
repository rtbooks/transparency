import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import {
  Building2,
  Users,
  DollarSign,
  Activity,
  TrendingUp,
  TrendingDown,
  Calendar,
} from 'lucide-react';

export default async function AdminAnalyticsPage() {
  // Fetch comprehensive analytics
  const [
    totalOrganizations,
    totalUsers,
    totalTransactions,
    recentOrganizations,
    recentUsers,
  ] = await Promise.all([
    prisma.organization.count({ where: buildCurrentVersionWhere({}) }),
    prisma.user.count(),
    prisma.transaction.count({ where: buildCurrentVersionWhere({}) }),
    prisma.organization.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: buildCurrentVersionWhere({}),
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    }),
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        email: true,
        createdAt: true,
      },
    }),
  ]);

  // Get counts for recent orgs
  const recentOrgIds = recentOrganizations.map(o => o.id);
  const [orgUserCounts, txCounts] = recentOrgIds.length > 0
    ? await Promise.all([
        prisma.organizationUser.groupBy({
          by: ['organizationId'],
          where: buildCurrentVersionWhere({ organizationId: { in: recentOrgIds } }),
          _count: true,
        }),
        prisma.transaction.groupBy({
          by: ['organizationId'],
          where: buildCurrentVersionWhere({ organizationId: { in: recentOrgIds } }),
          _count: true,
        }),
      ])
    : [[], []];
  const ouCountMap = new Map(orgUserCounts.map(c => [c.organizationId, c._count]));
  const txCountMap = new Map(txCounts.map(c => [c.organizationId, c._count]));
  const recentOrgsWithCounts = recentOrganizations.map(org => ({
    ...org,
    _count: {
      organizationUsers: ouCountMap.get(org.id) || 0,
      transactions: txCountMap.get(org.id) || 0,
    },
  }));

  // Calculate transaction volume
  const transactionSum = await prisma.transaction.aggregate({
    _sum: {
      amount: true,
    },
  });
  const totalVolume = Number(transactionSum._sum.amount || 0);

  // Calculate growth metrics (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [newOrgsLast30Days, newUsersLast30Days, newTransactionsLast30Days] =
    await Promise.all([
      prisma.organization.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      prisma.transaction.count({
        where: {
          transactionDate: {
            gte: thirtyDaysAgo,
          },
        },
      }),
    ]);

  const stats = [
    {
      name: 'Total Organizations',
      value: totalOrganizations,
      change: `+${newOrgsLast30Days} this month`,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      trending: newOrgsLast30Days > 0,
    },
    {
      name: 'Total Users',
      value: totalUsers,
      change: `+${newUsersLast30Days} this month`,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      trending: newUsersLast30Days > 0,
    },
    {
      name: 'Total Transactions',
      value: totalTransactions,
      change: `+${newTransactionsLast30Days} this month`,
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      trending: newTransactionsLast30Days > 0,
    },
    {
      name: 'Transaction Volume',
      value: `$${totalVolume.toLocaleString()}`,
      change: 'All time',
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      trending: true,
    },
  ];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Analytics</h1>
        <p className="mt-2 text-sm text-gray-600">
          Platform-wide metrics and growth insights
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trending ? TrendingUp : TrendingDown;
          return (
            <div
              key={stat.name}
              className="overflow-hidden rounded-lg bg-white shadow"
            >
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <TrendIcon
                    className={`h-5 w-5 ${
                      stat.trending ? 'text-green-600' : 'text-gray-400'
                    }`}
                  />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-600">
                    {stat.name}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{stat.change}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Organizations */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Organizations
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentOrgsWithCounts.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No organizations yet
              </div>
            ) : (
              recentOrgsWithCounts.map((org, index) => (
                <div key={index} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {org.name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        <Calendar className="inline h-3 w-3 mr-1" />
                        {formatDate(org.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end text-xs text-gray-500">
                      <span>{org._count.organizationUsers} users</span>
                      <span>{org._count.transactions} transactions</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Users
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentUsers.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No users yet
              </div>
            ) : (
              recentUsers.map((user, index) => (
                <div key={index} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {user.name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">{user.email}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      <Calendar className="inline h-3 w-3 mr-1" />
                      {formatDate(user.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Growth Insights */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">
          30-Day Growth Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm text-gray-600">New Organizations</p>
            <p className="text-2xl font-bold text-blue-900">
              {newOrgsLast30Days}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm text-gray-600">New Users</p>
            <p className="text-2xl font-bold text-blue-900">
              {newUsersLast30Days}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4">
            <p className="text-sm text-gray-600">New Transactions</p>
            <p className="text-2xl font-bold text-blue-900">
              {newTransactionsLast30Days}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

