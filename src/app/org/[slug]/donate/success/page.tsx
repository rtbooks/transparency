import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Donation Successful" };

export default async function DonationSuccessPage({ params }: Props) {
  const { slug } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="mx-auto max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Thank You for Your Donation!
        </h1>
        <p className="mt-2 text-gray-600">
          Your payment has been processed successfully.
        </p>
        <div className="mt-6">
          <Link
            href={`/org/${slug}`}
            className="inline-block rounded-md bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Back to Organization
          </Link>
        </div>
      </div>
    </div>
  );
}
