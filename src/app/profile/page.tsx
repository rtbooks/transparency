import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { TopNavWrapper } from '@/components/navigation/TopNavWrapper';
import { getPublicNavLinks } from '@/lib/navigation';

export default async function ProfilePage() {
  const user = await currentUser();

  if (!user) {
    redirect('/login');
  }

  const userEmail = user.emailAddresses[0]?.emailAddress || '';
  const adminEmails = process.env.PLATFORM_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  const isPlatformAdmin = adminEmails.includes(userEmail.toLowerCase());

  // Helper to enrich a user with their organizations
  async function enrichUserWithOrgs(userId: string) {
    const orgUserRecords = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ userId }),
    });
    const orgIds = orgUserRecords.map(ou => ou.organizationId);
    const orgs = orgIds.length > 0
      ? await prisma.organization.findMany({
          where: buildCurrentVersionWhere({ id: { in: orgIds } }),
        })
      : [];
    const orgMap = new Map(orgs.map(o => [o.id, o]));
    return orgUserRecords.map(ou => ({
      ...ou,
      organization: orgMap.get(ou.organizationId)!,
    }));
  }

  // Try to find or create user in our database
  let dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  });

  let dbUserOrganizations = dbUser ? await enrichUserWithOrgs(dbUser.id) : [];

  // Clerk instance migration: authId changed but email already exists in DB
  if (!dbUser) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (existingByEmail) {
      // Migrate the authId to the new Clerk user ID and sync admin status
      dbUser = await prisma.user.update({
        where: { email: userEmail },
        data: {
          authId: user.id,
          avatarUrl: user.imageUrl,
          isPlatformAdmin,
        },
      });
      dbUserOrganizations = await enrichUserWithOrgs(dbUser.id);
      console.log(`✅ Migrated authId for existing user: ${dbUser.email}`);
    }
  }

  // Create user if doesn't exist
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        authId: user.id,
        email: userEmail,
        name: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`
          : user.username || 'User',
        avatarUrl: user.imageUrl,
        isPlatformAdmin,
      },
    });

    if (isPlatformAdmin) {
      console.log(`✅ Platform admin created: ${dbUser.email}`);
    }

    // Check for pending invitations for this email
    const pendingInvitations = await prisma.invitation.findMany({
      where: {
        email: dbUser.email.toLowerCase(),
        status: 'PENDING',
      },
    });

    // Resolve organizations for pending invitations
    const invOrgIds = [...new Set(pendingInvitations.map(inv => inv.organizationId))];
    const invOrgs = invOrgIds.length > 0
      ? await prisma.organization.findMany({
          where: buildCurrentVersionWhere({ id: { in: invOrgIds } }),
        })
      : [];
    const invOrgMap = new Map(invOrgs.map(o => [o.id, o]));

    // Auto-accept all pending invitations
    for (const invitation of pendingInvitations) {
      const now = new Date();
      const isExpired = invitation.expiresAt < now;

      if (!isExpired) {
        try {
          await prisma.$transaction([
            // Create organization membership
            prisma.organizationUser.create({
              data: {
                userId: dbUser.id,
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

          // Redirect to the first organization that was just joined
          if (pendingInvitations.length === 1) {
            const invOrg = invOrgMap.get(invitation.organizationId);
            if (invOrg) {
              redirect(`/org/${invOrg.slug}/dashboard`);
            }
          }
        } catch (error) {
          console.error('Error auto-accepting invitation:', error);
          // Continue to next invitation
        }
      }
    }

    // If multiple invitations were accepted, reload the organizations
    if (pendingInvitations.length > 1) {
      const reloadedUser = await prisma.user.findUnique({
        where: { authId: user.id },
      });
      if (reloadedUser) {
        dbUser = reloadedUser;
        dbUserOrganizations = await enrichUserWithOrgs(dbUser.id);
      }
    }
  }

  // At this point dbUser should never be null, but TypeScript doesn't know that
  if (!dbUser) {
    redirect('/login');
  }

  // Fetch the user's linked contact profiles across orgs
  const contactProfiles = dbUserOrganizations.length > 0
    ? await prisma.contact.findMany({
        where: buildCurrentVersionWhere({
          userId: dbUser.id,
          organizationId: { in: dbUserOrganizations.map(ou => ou.organizationId) },
        }),
      })
    : [];
  const contactByOrgId = new Map(contactProfiles.map(c => [c.organizationId, c]));

  const navLinks = getPublicNavLinks();

  return (
    <>
      <TopNavWrapper navLinks={navLinks} />
      <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="mt-2 text-gray-600">Welcome, {dbUser.name}!</p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Your Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="font-medium text-gray-700">Name:</span>{' '}
              <span className="text-gray-900">{dbUser.name}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Email:</span>{' '}
              <span className="text-gray-900">{dbUser.email}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Total Donated:</span>{' '}
              <span className="text-gray-900">
                ${dbUser.totalDonated.toString()}
              </span>
            </div>
          </div>
        </div>

        {dbUserOrganizations.length > 0 && (
          <div className="mt-8 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Your Organizations
            </h2>
            <ul className="space-y-3">
              {dbUserOrganizations.map((orgUser) => {
                const contact = contactByOrgId.get(orgUser.organizationId);
                return (
                  <li key={orgUser.id}>
                    <a
                      href={`/org/${orgUser.organization.slug}/dashboard`}
                      className="block rounded-lg border border-gray-200 p-4 transition hover:border-gray-300 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {orgUser.organization.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            Role: {orgUser.role}
                          </div>
                        </div>
                        {contact && (
                          <div className="text-right">
                            <div className="flex gap-1">
                              {contact.roles.map((r: string) => (
                                <span
                                  key={r}
                                  className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500">
                              Contact: {contact.name}
                            </div>
                          </div>
                        )}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {dbUserOrganizations.length === 0 && (
          <div className="mt-8 rounded-lg bg-blue-50 p-6">
            <p className="text-blue-900">
              You're not part of any organizations yet. Start by exploring
              organizations on the platform or contact an organization
              administrator to get access.
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
