import Link from "next/link";
import { User } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getUserOrganizations(clerkUserId: string) {
  // First, find the database user by their Clerk auth ID
  const dbUser = await prisma.user.findUnique({
    where: {
      authId: clerkUserId,
    },
    select: {
      id: true,
    },
  });

  if (!dbUser) {
    return [];
  }

  // Then fetch their organizations
  const orgUsers = await prisma.organizationUser.findMany({
    where: {
      userId: dbUser.id,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          _count: {
            select: {
              transactions: true,
            },
          },
        },
      },
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  return orgUsers.map((ou) => ou.organization);
}

interface UserDashboardProps {
  user: User;
}

export async function UserDashboard({ user }: UserDashboardProps) {
  const organizations = await getUserOrganizations(user.id);

  return (
    <div className="bg-white">
      {/* Welcome Header */}
      <section className="border-b bg-gradient-to-b from-blue-50 to-white py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-2 text-4xl font-bold">
              Welcome back, {user.firstName || "there"}!
            </h1>
            <p className="text-lg text-gray-600">
              {organizations.length > 0
                ? "Manage your organizations and view their financial data"
                : "Get started by creating your first organization"}
            </p>
          </div>
        </div>
      </section>

      {/* User's Organizations */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Your Organizations</h2>
              <Link
                href="/organizations/new"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                + New Organization
              </Link>
            </div>

            {organizations.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                <div className="mb-4 text-5xl">🏢</div>
                <h3 className="mb-2 text-xl font-semibold">
                  No Organizations Yet
                </h3>
                <p className="mb-6 text-gray-600">
                  Create your first organization to start publishing financial transparency.
                </p>
                <Link
                  href="/organizations/new"
                  className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Create Organization
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {organizations.map((org) => (
                  <Link
                    key={org.id}
                    href={`/${org.slug}/dashboard`}
                    className="group rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="mb-1 text-xl font-semibold text-gray-900 group-hover:text-blue-600">
                          {org.name}
                        </h3>
                        <p className="mb-3 text-sm text-gray-500">
                          {org._count.transactions} transactions
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            org.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {org.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-4 border-t pt-4">
                      <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
                        Open Dashboard →
                      </span>
                      <Link
                        href={`/${org.slug}`}
                        className="text-sm text-gray-500 hover:text-gray-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Public Page
                      </Link>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Browse Other Organizations */}
      <section className="border-t bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 text-2xl font-bold">
              Discover Other Transparent Organizations
            </h2>
            <p className="mb-6 text-gray-600">
              Explore how other nonprofits are using financial transparency
            </p>
            <Link
              href="/organizations"
              className="inline-block rounded-lg border-2 border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:border-gray-400 hover:bg-white"
            >
              Browse All Organizations
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
