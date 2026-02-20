import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OrganizationService } from '@/services/organization.service';
import { generateIncomeStatement } from '@/lib/reporting/temporal-reports';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const comparePrior = searchParams.get('comparePrior') === 'true';
    const priorStartDateStr = searchParams.get('priorStartDate');
    const priorEndDateStr = searchParams.get('priorEndDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'startDate and endDate parameters are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'startDate must be before endDate' },
        { status: 400 }
      );
    }

    const organization = await OrganizationService.findBySlug(slug);
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const current = await generateIncomeStatement(
      organization.id,
      startDate,
      endDate
    );

    if (comparePrior && priorStartDateStr && priorEndDateStr) {
      const priorStartDate = new Date(priorStartDateStr);
      const priorEndDate = new Date(priorEndDateStr);

      if (!isNaN(priorStartDate.getTime()) && !isNaN(priorEndDate.getTime())) {
        const prior = await generateIncomeStatement(
          organization.id,
          priorStartDate,
          priorEndDate
        );
        return NextResponse.json({ current, prior });
      }
    }

    return NextResponse.json(comparePrior ? { current, prior: null } : current);
  } catch (error) {
    console.error('Error generating income statement:', error);
    return NextResponse.json(
      { error: 'Failed to generate income statement' },
      { status: 500 }
    );
  }
}
