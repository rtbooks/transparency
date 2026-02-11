import { prisma } from "@/lib/prisma";

async function getStats() {
  const [orgCount, transactionCount] = await Promise.all([
    prisma.organization.count({
      where: { status: "ACTIVE" },
    }),
    prisma.transaction.count(),
  ]);

  return {
    organizations: orgCount,
    transactions: transactionCount,
  };
}

export async function SocialProof() {
  const stats = await getStats();

  return (
    <section className="border-b bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-12 md:flex-row">
          <div className="text-center">
            <div className="mb-2 text-5xl font-bold text-blue-600">
              {stats.organizations}
            </div>
            <div className="text-sm text-gray-600">
              Transparent Organizations
            </div>
          </div>
          <div className="text-center">
            <div className="mb-2 text-5xl font-bold text-green-600">
              {stats.transactions.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">
              Published Transactions
            </div>
          </div>
          <div className="text-center">
            <div className="mb-2 text-5xl font-bold text-purple-600">
              100%
            </div>
            <div className="text-sm text-gray-600">
              Verified 501(c)(3)s
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
