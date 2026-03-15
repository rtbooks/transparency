import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

const E2E_ORG_SLUG = 'e2e-test-org';
const E2E_DONOR_EMAIL = 'e2e-donor@radbooks.org';

/**
 * POST /api/e2e/cleanup-donor
 * Removes the donor user's membership and access requests from the test org.
 * Only available in development/test environments.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const org = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug: E2E_ORG_SLUG }),
  });
  const donor = await prisma.user.findUnique({
    where: { email: E2E_DONOR_EMAIL },
  });

  if (!org || !donor) {
    return NextResponse.json({ error: 'E2E data not found' }, { status: 404 });
  }

  // Remove membership
  await prisma.organizationUser.deleteMany({
    where: { organizationId: org.id, userId: donor.id },
  });

  // Remove access requests
  await prisma.accessRequest.deleteMany({
    where: { organizationId: org.id, userId: donor.id },
  });

  return NextResponse.json({ ok: true });
}
