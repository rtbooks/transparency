import { ReactNode } from 'react';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { TopNavWrapper } from './TopNavWrapper';
import { OrgSidebarWrapper } from './OrgSidebarWrapper';
import { getOrganizationNavLinks } from '@/lib/navigation';
import type { NavLink } from '@/lib/navigation';

interface OrganizationLayoutWrapperProps {
  children: ReactNode;
  organizationSlug: string;
}

export async function OrganizationLayoutWrapper({
  children,
  organizationSlug,
}: OrganizationLayoutWrapperProps) {
  const { userId: clerkUserId } = await auth();

  // Determine navigation links based on user's role
  let navLinks: NavLink[] = [{ label: 'Dashboard', href: `/org/${organizationSlug}` }];

  if (clerkUserId) {
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
      include: {
        organizations: {
          where: {
            organization: {
              slug: organizationSlug,
            },
          },
        },
      },
    });

    if (user && user.organizations.length > 0) {
      const userRole = user.organizations[0].role;
      navLinks = getOrganizationNavLinks(organizationSlug, userRole);
    }
  }

  return (
    <>
      <TopNavWrapper organizationSlug={organizationSlug} navLinks={navLinks} />
      <div className="flex">
        <OrgSidebarWrapper navLinks={navLinks} />
        <main className="min-h-[calc(100vh-4rem)] flex-1 overflow-auto">{children}</main>
      </div>
    </>
  );
}
