import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

export type OrganizationAccessCheck = {
  organization: any;
  userAccess: any;
  user: any;
};

/**
 * Check if a user has access to an organization and if the organization is verified.
 * For authenticated routes (dashboard, settings, etc.)
 */
export async function checkOrganizationAccess(
  slug: string,
  userId: string,
  requireVerified: boolean = true
): Promise<OrganizationAccessCheck> {
  const user = await prisma.user.findUnique({
    where: { authId: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });

  if (!organization) {
    notFound();
  }

  const orgUsers = await prisma.organizationUser.findMany({
    where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
  });
  const userAccess = orgUsers[0] ?? null;

  return { organization, userAccess, user };
}

/**
 * Component for displaying verification status messages
 */
export function VerificationStatusMessage({ 
  status, 
  organizationName, 
  notes 
}: { 
  status: string;
  organizationName: string;
  notes?: string | null;
}) {
  if (status === 'PENDING_VERIFICATION') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">⏳</div>
          <h1 className="text-2xl font-bold text-gray-900">Verification Pending</h1>
          <p className="mt-4 text-gray-600">
            Your organization <strong>{organizationName}</strong> is currently under review.
          </p>
          <p className="mt-2 text-gray-600">
            You'll receive an email once your organization has been verified by our team.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'VERIFICATION_FAILED') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">❌</div>
          <h1 className="text-2xl font-bold text-gray-900">Verification Failed</h1>
          <p className="mt-4 text-gray-600">
            Unfortunately, your organization <strong>{organizationName}</strong> could not be verified.
          </p>
          {notes && (
            <div className="mt-4 rounded-lg bg-gray-100 p-4 text-left">
              <p className="text-sm font-semibold text-gray-700">Reason:</p>
              <p className="mt-1 text-sm text-gray-600">{notes}</p>
            </div>
          )}
          <p className="mt-4 text-sm text-gray-500">
            Please contact support if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
