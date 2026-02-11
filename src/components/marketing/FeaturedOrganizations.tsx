import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getFeaturedOrganizations() {
  const orgs = await prisma.organization.findMany({
    where: {
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      mission: true,
      _count: {
        select: {
          transactions: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 3,
  });

  return orgs;
}

export async function FeaturedOrganizations() {
  const organizations = await getFeaturedOrganizations();

  if (organizations.length === 0) {
    return null;
  }

  return (
    <section className="border-t bg-gray-50 py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-4xl font-bold">
            Featured Organizations
          </h2>
          <p className="mb-12 text-center text-lg text-gray-600">
            Nonprofits leading the way in financial transparency
          </p>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <Link
                key={org.id}
                href={`/org/${org.slug}`}
                className="group rounded-lg border border-gray-200 bg-white p-6 transition-all hover:shadow-lg"
              >
                <h3 className="mb-2 text-xl font-semibold text-gray-900 group-hover:text-blue-600">
                  {org.name}
                </h3>
                
                {org.mission && (
                  <p className="mb-4 line-clamp-2 text-sm text-gray-600">
                    {org.mission}
                  </p>
                )}
                
                <div className="flex items-center justify-between border-t pt-4 text-sm">
                  <span className="text-gray-500">
                    {org._count.transactions} transactions
                  </span>
                  <span className="font-medium text-blue-600 group-hover:text-blue-700">
                    View Dashboard →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/organizations"
              className="inline-block rounded-lg border-2 border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              View All Organizations
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
