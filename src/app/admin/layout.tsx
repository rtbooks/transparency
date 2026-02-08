import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  // Find user and check if they're a platform admin
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
    include: {
      organizations: {
        where: {
          role: 'PLATFORM_ADMIN',
        },
      },
    },
  });

  // Check if user is a platform admin in at least one organization
  const isPlatformAdmin = user?.organizations.some(
    (org) => org.role === 'PLATFORM_ADMIN'
  );

  if (!user || !isPlatformAdmin) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin Navigation */}
      <nav className="bg-gray-900 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Platform Admin</h1>
              <div className="ml-10 flex items-baseline space-x-4">
                <a
                  href="/admin/dashboard"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Dashboard
                </a>
                <a
                  href="/admin/organizations"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Organizations
                </a>
                <a
                  href="/admin/users"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Users
                </a>
                <a
                  href="/admin/analytics"
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Analytics
                </a>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-300">{user.name}</span>
              <a
                href="/"
                className="ml-4 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
              >
                Exit Admin
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
