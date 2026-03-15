/**
 * E2E Test Database Helper
 *
 * Provides direct Prisma access for E2E test setup/teardown,
 * keeping test-only code out of the production codebase.
 */

import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

let prisma: PrismaClient | null = null;

function getDbUrl(): string {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required for E2E db helper');
  return url;
}

export function getE2EPrisma(): PrismaClient {
  if (!prisma) {
    const adapter = new PrismaPg({ connectionString: getDbUrl() });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

const MAX_DATE = new Date('9999-12-31T23:59:59.999Z');

/**
 * Remove donor's org membership and access requests, simulating admin removal.
 */
export async function cleanupDonorMembership(orgSlug: string, donorEmail: string) {
  const db = getE2EPrisma();

  const org = await db.organization.findFirst({
    where: { slug: orgSlug, validTo: MAX_DATE },
  });
  const donor = await db.user.findUnique({
    where: { email: donorEmail },
  });

  if (!org || !donor) {
    throw new Error(`E2E data not found: org=${orgSlug}, donor=${donorEmail}`);
  }

  await db.organizationUser.deleteMany({
    where: { organizationId: org.id, userId: donor.id },
  });
  await db.accessRequest.deleteMany({
    where: { organizationId: org.id, userId: donor.id },
  });
}
