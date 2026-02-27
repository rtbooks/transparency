import type { Metadata } from 'next';
import Link from 'next/link';
import { XCircle } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Donation Cancelled" };

export default async function DonationCancelPage({ params }: Props) {
  const { slug } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="mx-auto max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <XCircle className="mx-auto h-16 w-16 text-orange-400" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Donation Cancelled
        </h1>
        <p className="mt-2 text-gray-600">
          Your donation was not processed. No charges were made.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link
            href={`/org/${slug}`}
            className="inline-block rounded-md border px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Organization
          </Link>
          <Link
            href={`/org/${slug}/donate`}
            className="inline-block rounded-md bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Try Again
          </Link>
        </div>
      </div>
    </div>
  );
}
