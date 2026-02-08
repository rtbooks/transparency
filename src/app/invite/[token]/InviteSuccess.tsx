'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface InviteSuccessProps {
  organizationSlug: string;
  organizationName: string;
  role: string;
}

export function InviteSuccess({ organizationSlug, organizationName, role }: InviteSuccessProps) {
  const router = useRouter();

  useEffect(() => {
    // Redirect after a short delay to show the success message
    const timeout = setTimeout(() => {
      router.push(`/org/${organizationSlug}/dashboard`);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [organizationSlug, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to {organizationName}!
          </h1>
          <p className="mt-2 text-gray-600">
            You've successfully joined as <strong>{role}</strong>
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Redirecting to dashboard...
          </p>
          <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-full animate-pulse bg-blue-600" style={{ animation: 'pulse 2s ease-in-out' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
