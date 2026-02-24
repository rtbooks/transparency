import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { InviteSuccess } from './InviteSuccess';
import { ROLE_LABELS } from '@/lib/auth/permissions';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const { userId: clerkUserId } = await auth();

  // User must be authenticated to accept an invitation
  if (!clerkUserId) {
    // Redirect to login, and Clerk will redirect back here after authentication
    redirect(`/login?redirect_url=${encodeURIComponent(`/invite/${token}`)}`);
  }

  // Find or create the user in our database
  let user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
  });

  if (!user) {
    // New user — create DB record inline so they don't detour through /profile
    const clerkUser = await currentUser();
    if (!clerkUser) {
      redirect(`/login?redirect_url=${encodeURIComponent(`/invite/${token}`)}`);
    }

    const userEmail = clerkUser.emailAddresses[0]?.emailAddress || '';
    const adminEmails = process.env.PLATFORM_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    const isPlatformAdmin = adminEmails.includes(userEmail.toLowerCase());

    // Check for existing user by email (Clerk instance migration)
    const existingByEmail = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { email: userEmail },
        data: { authId: clerkUser.id, avatarUrl: clerkUser.imageUrl, isPlatformAdmin },
      });
    } else {
      user = await prisma.user.create({
        data: {
          authId: clerkUser.id,
          email: userEmail,
          name: clerkUser.firstName && clerkUser.lastName
            ? `${clerkUser.firstName} ${clerkUser.lastName}`
            : clerkUser.username || 'User',
          avatarUrl: clerkUser.imageUrl,
          isPlatformAdmin,
        },
      });
    }
  }

  // Find the invitation by token
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      invitedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!invitation) {
    notFound();
  }

  // Resolve organization separately (bitemporal)
  const invitationOrganization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ id: invitation.organizationId }),
  });

  if (!invitationOrganization) {
    notFound();
  }

  // Check if invitation is valid
  const now = new Date();
  const isExpired = invitation.expiresAt < now;
  const isRevoked = invitation.status === 'REVOKED';
  const isAccepted = invitation.status === 'ACCEPTED';

  // Handle invalid invitation states
  if (isRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Invitation Revoked
            </h1>
            <p className="mt-2 text-gray-600">
              This invitation has been revoked by an administrator.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Please contact {invitation.invitedBy.name} ({invitation.invitedBy.email}) 
              if you believe this is an error.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Invitation Expired
            </h1>
            <p className="mt-2 text-gray-600">
              This invitation expired on {invitation.expiresAt.toLocaleDateString()}.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Please contact {invitation.invitedBy.name} ({invitation.invitedBy.email}) 
              to request a new invitation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isAccepted) {
    // Invitation already accepted - redirect to organization
    redirect(`/org/${invitationOrganization.slug}/dashboard`);
  }

  // Check if user is already a member of this organization
  const existingMemberships = await prisma.organizationUser.findMany({
    where: buildCurrentVersionWhere({
      userId: user.id,
      organizationId: invitation.organizationId,
    }),
  });
  const existingMembership = existingMemberships[0];

  if (existingMembership) {
    // User is already a member - mark invitation as accepted if not already
    if (invitation.status === 'PENDING') {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Show success message and redirect via client component
    return (
      <InviteSuccess
        organizationSlug={invitationOrganization.slug}
        organizationName={invitationOrganization.name}
        role={ROLE_LABELS[existingMembership.role]}
      />
    );
  }

  // All checks passed - create the organization membership
  try {
    await prisma.$transaction(async (tx) => {
      // Create organization membership
      await tx.organizationUser.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });
      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Auto-link existing contact record by invitation email or user email
      if (invitation.role === 'SUPPORTER') {
        const existingContact = await tx.contact.findFirst({
          where: buildCurrentVersionWhere({
            organizationId: invitation.organizationId,
            userId: null,
            OR: [
              { email: { equals: invitation.email, mode: 'insensitive' } },
              ...(user.email.toLowerCase() !== invitation.email.toLowerCase()
                ? [{ email: { equals: user.email, mode: 'insensitive' as const } }]
                : []),
            ],
          }),
        });

        if (existingContact) {
          await tx.contact.update({
            where: { versionId: existingContact.versionId },
            data: { userId: user.id },
          });
        }
      }
    });

    // Show success message and redirect via client component
    return (
      <InviteSuccess
        organizationSlug={invitationOrganization.slug}
        organizationName={invitationOrganization.name}
        role={ROLE_LABELS[invitation.role]}
      />
    );
  } catch (error) {
    console.error('Error accepting invitation:', error);
    
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Error Accepting Invitation
            </h1>
            <p className="mt-2 text-gray-600">
              An error occurred while accepting the invitation.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Please try again or contact {invitation.invitedBy.name} for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
