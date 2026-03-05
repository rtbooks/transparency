/**
 * Ensure a database User record exists for the currently authenticated Clerk user.
 *
 * This handles the case where a user completes Clerk SSO (e.g., via a donation
 * link) but hasn't visited /profile yet, so no DB record exists.
 */

import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import type { User } from '@/generated/prisma/client';

/**
 * Find or create a database user for the given Clerk auth ID.
 * Falls back to the current Clerk session to obtain user details when
 * the DB record doesn't exist yet.
 *
 * @param clerkAuthId - The Clerk user ID (from auth())
 * @returns The database User record
 * @throws Error if Clerk session is invalid or user creation fails
 */
export async function ensureUserExists(clerkAuthId: string): Promise<User> {
  // Fast path: user already exists
  const existing = await prisma.user.findUnique({ where: { authId: clerkAuthId } });
  if (existing) return existing;

  // Fetch Clerk user details to create the DB record
  const clerkUser = await currentUser();
  if (!clerkUser || clerkUser.id !== clerkAuthId) {
    throw new Error('User not found');
  }

  const userEmail = clerkUser.emailAddresses[0]?.emailAddress || '';
  const adminEmails = process.env.PLATFORM_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  const isPlatformAdmin = adminEmails.includes(userEmail.toLowerCase());

  // Clerk instance migration: authId changed but email already exists
  const existingByEmail = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (existingByEmail) {
    return prisma.user.update({
      where: { email: userEmail },
      data: {
        authId: clerkUser.id,
        avatarUrl: clerkUser.imageUrl,
        isPlatformAdmin,
      },
    });
  }

  // Create brand-new user
  const created = await prisma.user.create({
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
    console.log(`✅ Platform admin created: ${created.email}`);
  }

  return created;
}
