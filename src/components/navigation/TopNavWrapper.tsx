import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { TopNav } from './TopNav';
import { NavLink } from '@/lib/navigation';
import { buildCurrentVersionWhere, buildEntitiesWhere, buildEntityMap, MAX_DATE } from '@/lib/temporal/temporal-utils';

interface TopNavWrapperProps {
  organizationSlug?: string;
  navLinks: NavLink[];
  orgTheme?: { primaryColor?: string | null; accentColor?: string | null; logoUrl?: string | null };
}

export async function TopNavWrapper({
  organizationSlug,
  navLinks,
  orgTheme,
}: TopNavWrapperProps) {
  const { userId: clerkUserId } = await auth();

  let user = null;
  let organizationContext = null;
  let userOrganizations: any[] = [];

  if (clerkUserId) {
    // Fetch user with their organizations
    const dbUser = await prisma.user.findUnique({
      where: { authId: clerkUserId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        isPlatformAdmin: true,
      },
    });

    if (dbUser) {
      user = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatarUrl: dbUser.avatarUrl,
        isPlatformAdmin: dbUser.isPlatformAdmin,
      };

      // Resolve user's org memberships and their organizations
      const orgUserRecords = await prisma.organizationUser.findMany({
        where: buildCurrentVersionWhere({ userId: dbUser.id }),
      });
      const orgIds = [...new Set(orgUserRecords.map(ou => ou.organizationId))];
      const orgs = orgIds.length > 0
        ? await prisma.organization.findMany({
            where: { id: { in: orgIds }, validTo: MAX_DATE, isDeleted: false },
            select: { id: true, name: true, slug: true, verificationStatus: true },
          })
        : [];
      const orgMap = new Map(orgs.map(o => [o.id, o]));

      // Map user organizations - only include VERIFIED organizations
      userOrganizations = orgUserRecords
        .filter((orgUser) => {
          const org = orgMap.get(orgUser.organizationId);
          return org && org.verificationStatus === 'VERIFIED';
        })
        .map((orgUser) => {
          const org = orgMap.get(orgUser.organizationId)!;
          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            role: orgUser.role,
          };
        });

      // If we're in an organization context, find it
      if (organizationSlug) {
        const currentOrg = userOrganizations.find(
          (org) => org.slug === organizationSlug
        );
        if (currentOrg) {
          organizationContext = {
            id: currentOrg.id,
            name: currentOrg.name,
            slug: currentOrg.slug,
          };
        } else {
          // User is viewing an org they're not a member of - fetch public info
          const org = await prisma.organization.findFirst({
            where: buildCurrentVersionWhere({ slug: organizationSlug }),
            select: { id: true, name: true, slug: true },
          });
          if (org) {
            organizationContext = org;
          }
        }
      }
    }
  } else if (organizationSlug) {
    // Anonymous user viewing public org page
    const org = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug: organizationSlug }),
      select: { id: true, name: true, slug: true },
    });
    if (org) {
      organizationContext = org;
    }
  }

  return (
    <TopNav
      user={user}
      organizationContext={organizationContext}
      userOrganizations={userOrganizations}
      navLinks={navLinks}
      orgLogoUrl={orgTheme?.logoUrl}
    />
  );
}
