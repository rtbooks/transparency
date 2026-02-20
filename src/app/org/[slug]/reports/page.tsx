import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { checkOrganizationAccess } from '@/lib/organization-access';
import { FileText, BarChart3, PieChart } from 'lucide-react';

interface ReportsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  const { organization } = await checkOrganizationAccess(slug, clerkUserId, false);

  const reports = [
    {
      title: 'Income Statement',
      description:
        'Revenue and expenses for a fiscal period. Shows how much money came in, how much went out, and the resulting net income.',
      href: `/org/${slug}/reports/income-statement`,
      icon: BarChart3,
    },
    {
      title: 'Balance Sheet',
      description:
        'Financial position as of a specific date. Shows what the organization owns (assets), owes (liabilities), and the net equity.',
      href: `/org/${slug}/reports/balance-sheet`,
      icon: PieChart,
    },
    {
      title: 'Financial Dashboard',
      description:
        'Visual charts and trends. Revenue vs expenses by month, net income trend, and asset composition.',
      href: `/org/${slug}/reports/dashboard`,
      icon: FileText,
    },
  ];

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Financial Reports
            </h1>
            <p className="mt-2 text-gray-600">
              {organization.name} — Transparent financial reporting
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {reports.map((report) => (
              <Link
                key={report.title}
                href={report.href}
                className="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2 group-hover:bg-blue-100">
                    <report.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {report.title}
                  </h2>
                </div>
                <p className="text-sm text-gray-600">{report.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
