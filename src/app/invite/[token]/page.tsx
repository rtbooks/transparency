import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

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

  // Find the user in our database
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
  });

  if (!user) {
    redirect('/profile');
  }

  // Find the invitation by token
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: true,
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
    redirect(`/org/${invitation.organization.slug}/dashboard`);
  }

  // Check if user is already a member of this organization
  const existingMembership = await prisma.organizationUser.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: invitation.organizationId,
      },
    },
  });

  if (existingMembership) {
    // User is already a member - mark invitation as accepted and redirect
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    redirect(`/org/${invitation.organization.slug}/dashboard`);
  }

  // Check if the invited email matches the user's email
  const emailMatches = user.email.toLowerCase() === invitation.email.toLowerCase();

  if (!emailMatches) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <svg
                className="h-6 w-6 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Email Mismatch</h1>
            <p className="mt-2 text-gray-600">
              This invitation was sent to <strong>{invitation.email}</strong>
            </p>
            <p className="mt-1 text-gray-600">
              but you are logged in as <strong>{user.email}</strong>
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Please log in with the invited email address or contact {invitation.invitedBy.name} 
              to request an invitation for your current email.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // All checks passed - create the organization membership
  try {
    await prisma.$transaction([
      // Create organization membership
      prisma.organizationUser.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      }),
      // Mark invitation as accepted
      prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ]);

    // Redirect to the organization dashboard
    redirect(`/org/${invitation.organization.slug}/dashboard`);
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
