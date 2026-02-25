import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { createFiscalPeriod, listFiscalPeriods } from '@/services/fiscal-period.service';
import { z } from 'zod';

const createPeriodSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    if (!orgUser || orgUser.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const periods = await listFiscalPeriods(organization.id);
    return NextResponse.json(periods);
  } catch (error) {
    console.error('Error listing fiscal periods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    if (!orgUser || orgUser.role !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Only admins can manage fiscal periods' }, { status: 403 });
    }

    const body = await request.json();
    const validated = createPeriodSchema.parse(body);

    const period = await createFiscalPeriod({
      organizationId: organization.id,
      name: validated.name,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
    });

    return NextResponse.json(period, { status: 201 });
  } catch (error) {
    console.error('Error creating fiscal period:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('overlaps') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
