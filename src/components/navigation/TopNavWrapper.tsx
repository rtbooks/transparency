import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { TopNav } from './TopNav';
import { NavLink } from '@/lib/navigation';

interface TopNavWrapperProps {
  organizationSlug?: string;
  navLinks: NavLink[];
}

export async function TopNavWrapper({
  organizationSlug,
  navLinks,
}: TopNavWrapperProps) {
  const { userId: clerkUserId } = await auth();

  let user = null;
  let organizationContext = null;
  let userOrganizations: any[] = [];

  if (clerkUserId) {
    // Fetch user with their organizations
    const dbUser = await prisma.user.findUnique({
      where: { authId: clerkUserId },
      include: {
        organizations: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (dbUser) {
      // Check if user is platform admin
      const isPlatformAdmin = dbUser.organizations.some(
        (org) => org.role === 'PLATFORM_ADMIN'
      );

      user = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatarUrl: dbUser.avatarUrl,
        isPlatformAdmin,
      };

      // Map user organizations
      userOrganizations = dbUser.organizations.map((orgUser) => ({
        id: orgUser.organization.id,
        name: orgUser.organization.name,
        slug: orgUser.organization.slug,
        role: orgUser.role,
      }));

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
          const org = await prisma.organization.findUnique({
            where: { slug: organizationSlug },
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
    const org = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
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
    />
  );
}
