import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Browse Organizations | Financial Transparency Platform",
  description: "Discover verified 501(c)(3) nonprofits committed to complete financial transparency.",
};

async function getOrganizations() {
  const organizations = await prisma.organization.findMany({
    where: {
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      mission: true,
      ein: true,
      createdAt: true,
      _count: {
        select: {
          transactions: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return organizations;
}

export default async function OrganizationsPage() {
  const organizations = await getOrganizations();

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="border-b bg-gradient-to-b from-green-50 to-white py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 text-5xl font-bold tracking-tight">
              Transparent Organizations
            </h1>
            <p className="text-xl text-gray-600">
              Explore verified 501(c)(3) nonprofits committed to showing exactly 
              where every dollar goes.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center gap-8 md:flex-row md:gap-16">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">
                {organizations.length}
              </div>
              <div className="text-sm text-gray-600">
                Transparent Organizations
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600">
                {organizations.reduce((sum, org) => sum + org._count.transactions, 0)}
              </div>
              <div className="text-sm text-gray-600">
                Published Transactions
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600">100%</div>
              <div className="text-sm text-gray-600">Verified 501(c)(3)s</div>
            </div>
          </div>
        </div>
      </section>

      {/* Organizations Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {organizations.length === 0 ? (
            <div className="mx-auto max-w-2xl rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                No Organizations Yet
              </h3>
              <p className="mb-6 text-gray-600">
                Be one of the first nonprofits to join our transparency platform!
              </p>
              <Link
                href="/register"
                className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Get Started
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {organizations.map((org) => (
                <Link
                  key={org.id}
                  href={`/${org.slug}`}
                  className="group rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-lg"
                >
                  <div className="mb-4">
                    <h3 className="mb-2 text-xl font-semibold text-gray-900 group-hover:text-blue-600">
                      {org.name}
                    </h3>
                    <p className="mb-2 text-sm text-gray-500">
                      EIN: {org.ein || "Pending verification"}
                    </p>
                  </div>

                  {org.mission && (
                    <p className="mb-4 line-clamp-3 text-sm text-gray-600">
                      {org.mission}
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-500">
                      {org._count.transactions} transactions
                    </div>
                    <div className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
                      View Dashboard →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold">
              Is Your Organization Ready for Transparency?
            </h2>
            <p className="mb-8 text-lg text-gray-600">
              Join these pioneering nonprofits in building unprecedented trust with 
              your donors and community.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Get Started Free
              </Link>
              <Link
                href="/about"
                className="rounded-lg border-2 border-gray-300 px-8 py-3 font-semibold text-gray-700 hover:border-gray-400"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
