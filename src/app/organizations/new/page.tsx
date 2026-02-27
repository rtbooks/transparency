import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CreateOrganizationForm } from '@/components/forms/CreateOrganizationForm';

export const metadata: Metadata = { title: "Create Organization" };

export default async function NewOrganizationPage() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  // Check if user exists in database
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
  });

  if (!user) {
    redirect('/profile'); // Will create user record
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Create a New Organization
          </h1>
          <p className="mt-2 text-gray-600">
            Set up your nonprofit organization's financial transparency platform
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <CreateOrganizationForm />
        </div>

        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-900">What happens next?</h3>
          <ul className="mt-2 space-y-1 text-sm text-blue-800">
            <li>• Your organization will be submitted for verification</li>
            <li>• Platform admins will review your EIN and information</li>
            <li>• You'll receive an email when your organization is approved (usually within 24 hours)</li>
            <li>• Once approved, you can start recording transactions and inviting team members</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
