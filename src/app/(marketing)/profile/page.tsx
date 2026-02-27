import type { Metadata } from 'next';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { ProfilePageClient } from './ProfilePageClient';

export const metadata: Metadata = { title: 'My Profile' };

export default async function ProfilePage() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect('/login');
  }

  const userEmail = clerkUser.emailAddresses[0]?.emailAddress || '';
  const adminEmails = process.env.PLATFORM_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  const isPlatformAdmin = adminEmails.includes(userEmail.toLowerCase());

  // Find or create user in database
  let dbUser = await prisma.user.findUnique({
    where: { authId: clerkUser.id },
  });

  // Clerk instance migration: authId changed but email already exists
  if (!dbUser) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (existingByEmail) {
      dbUser = await prisma.user.update({
        where: { email: userEmail },
        data: {
          authId: clerkUser.id,
          avatarUrl: clerkUser.imageUrl,
          isPlatformAdmin,
        },
      });
    }
  }

  // Create user if doesn't exist
  if (!dbUser) {
    dbUser = await prisma.user.create({
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

    if (isPlatformAdmin) {
      console.log(`✅ Platform admin created: ${dbUser.email}`);
    }

    // Auto-accept pending invitations
    const pendingInvitations = await prisma.invitation.findMany({
      where: {
        email: dbUser.email.toLowerCase(),
        status: 'PENDING',
      },
    });

    const invOrgIds = [...new Set(pendingInvitations.map(inv => inv.organizationId))];
    const invOrgs = invOrgIds.length > 0
      ? await prisma.organization.findMany({
          where: buildCurrentVersionWhere({ id: { in: invOrgIds } }),
        })
      : [];
    const invOrgMap = new Map(invOrgs.map(o => [o.id, o]));

    for (const invitation of pendingInvitations) {
      const isExpired = invitation.expiresAt < new Date();

      if (!isExpired) {
        try {
          await prisma.$transaction([
            prisma.organizationUser.create({
              data: {
                userId: dbUser.id,
                organizationId: invitation.organizationId,
                role: invitation.role,
              },
            }),
            prisma.invitation.update({
              where: { id: invitation.id },
              data: {
                status: 'ACCEPTED',
                acceptedAt: new Date(),
                updatedAt: new Date(),
              },
            }),
          ]);

          if (pendingInvitations.length === 1) {
            const invOrg = invOrgMap.get(invitation.organizationId);
            if (invOrg) {
              redirect(`/org/${invOrg.slug}/dashboard`);
            }
          }
        } catch (error) {
          console.error('Error auto-accepting invitation:', error);
        }
      }
    }
  }

  if (!dbUser) {
    redirect('/login');
  }

  // Fetch user's organizations with org details
  const orgUserRecords = await prisma.organizationUser.findMany({
    where: buildCurrentVersionWhere({ userId: dbUser.id }),
  });

  const orgIds = orgUserRecords.map(ou => ou.organizationId);
  const orgs = orgIds.length > 0
    ? await prisma.organization.findMany({
        where: buildCurrentVersionWhere({ id: { in: orgIds } }),
        select: { id: true, name: true, slug: true, logoUrl: true },
      })
    : [];
  const orgMap = new Map(orgs.map(o => [o.id, o]));

  // Fetch user's contact profiles across orgs
  const contactProfiles = orgIds.length > 0
    ? await prisma.contact.findMany({
        where: buildCurrentVersionWhere({
          userId: dbUser.id,
          organizationId: { in: orgIds },
        }),
      })
    : [];
  const contactByOrgId = new Map(contactProfiles.map(c => [c.organizationId, c]));

  // Fetch user's donations across all orgs
  const contactIds = contactProfiles.map(c => c.id);
  const donations = contactIds.length > 0
    ? await prisma.donation.findMany({
        where: {
          contactId: { in: contactIds },
        },
        orderBy: { donationDate: 'desc' },
        take: 50,
      })
    : [];

  // Fetch campaign names for donations
  const campaignIds = [...new Set(donations.filter(d => d.campaignId).map(d => d.campaignId!))];
  const campaigns = campaignIds.length > 0
    ? await prisma.campaign.findMany({
        where: { id: { in: campaignIds } },
        select: { id: true, name: true },
      })
    : [];
  const campaignMap = new Map(campaigns.map(c => [c.id, c.name]));

  // Map contact to org for donation display
  const contactOrgMap = new Map(contactProfiles.map(c => [c.id, c.organizationId]));

  const userOrganizations = orgUserRecords.map(ou => {
    const org = orgMap.get(ou.organizationId);
    const contact = contactByOrgId.get(ou.organizationId);
    return {
      id: ou.id,
      role: ou.role,
      organizationId: ou.organizationId,
      organization: {
        name: org?.name || 'Unknown',
        slug: org?.slug || '',
        logoUrl: org?.logoUrl || null,
      },
      contactName: contact?.name || null,
      contactRoles: (contact?.roles as string[]) || [],
    };
  });

  const userDonations = donations.map(d => {
    const donationOrgId = contactOrgMap.get(d.contactId);
    const org = donationOrgId ? orgMap.get(donationOrgId) : null;
    return {
      id: d.id,
      organizationName: org?.name || 'Unknown',
      organizationSlug: org?.slug || '',
      campaignName: d.campaignId ? campaignMap.get(d.campaignId) || null : null,
      amount: d.amount.toString(),
      amountReceived: d.amountReceived.toString(),
      type: d.type,
      status: d.status,
      donationDate: d.donationDate.toISOString(),
      dueDate: d.dueDate?.toISOString() || null,
    };
  });

  return (
    <ProfilePageClient
      user={{
        name: dbUser.name,
        email: dbUser.email,
        avatarUrl: dbUser.avatarUrl,
        totalDonated: dbUser.totalDonated.toString(),
        createdAt: dbUser.createdAt.toISOString(),
      }}
      organizations={userOrganizations}
      donations={userDonations}
    />
  );
}
