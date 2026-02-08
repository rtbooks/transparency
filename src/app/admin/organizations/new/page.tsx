'use client';

import { CreateOrganizationForm } from '@/components/forms/CreateOrganizationForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function AdminCreateOrganizationPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/admin/organizations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Organizations
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Create New Organization
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Set up a new nonprofit organization on the platform
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <CreateOrganizationForm
          onSuccess={(slug) => {
            window.location.href = `/admin/organizations`;
          }}
        />
      </div>

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="font-semibold text-blue-900">Admin Notes</h3>
        <ul className="mt-2 space-y-1 text-sm text-blue-800">
          <li>• As a platform admin, you can create organizations for other nonprofits</li>
          <li>• The organization will need an administrator assigned after creation</li>
          <li>• A default chart of accounts will be created automatically</li>
          <li>• You can manage this organization from the organizations list</li>
        </ul>
      </div>
    </div>
  );
}
