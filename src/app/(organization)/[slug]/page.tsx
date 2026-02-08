import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

interface OrganizationPageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganizationPublicPage({
  params,
}: OrganizationPageProps) {
  const { slug } = await params;
  const organization = await prisma.organization.findUnique({
    where: { slug },
  });

  if (!organization) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            {organization.name}
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Public Financial Transparency Dashboard
          </p>
          <div className="mt-8 text-gray-500">
            Coming soon: Financial overview, transaction history, and more
          </div>
        </div>
      </div>
    </div>
  );
}
