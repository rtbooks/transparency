import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, closeVersion, buildNewVersionData } from '@/lib/temporal/temporal-utils';
import { getTemplate } from '@/lib/templates/account-templates';

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

    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    if (!orgUser || orgUser.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const template = getTemplate(templateId as 'nonprofit-standard');

    if (template.length === 0) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const existingAccountCount = await prisma.account.count({
      where: buildCurrentVersionWhere({ organizationId: organization.id }),
    });

    if (existingAccountCount > 0) {
      return NextResponse.json(
        { error: 'Organization already has accounts. Template can only be applied to empty chart of accounts.' },
        { status: 400 }
      );
    }

    const accountMap = new Map<string, string>();

    for (const accountTemplate of template) {
      const account = await prisma.account.create({
        data: {
          code: accountTemplate.code,
          name: accountTemplate.name,
          type: accountTemplate.type,
          description: accountTemplate.description || null,
          organizationId: organization.id,
          currentBalance: 0,
          isActive: true,
          parentAccountId: null,
        },
      });

      accountMap.set(accountTemplate.code, account.id);
    }

    for (const accountTemplate of template) {
      if (accountTemplate.parentCode) {
        const accountId = accountMap.get(accountTemplate.code);
        const parentId = accountMap.get(accountTemplate.parentCode);

        if (accountId && parentId) {
          const acctToUpdate = await prisma.account.findFirst({
            where: buildCurrentVersionWhere({ id: accountId }),
          });
          if (acctToUpdate) {
            const now = new Date();
            await closeVersion(prisma.account, acctToUpdate.versionId, now, 'account');
            await prisma.account.create({
              data: buildNewVersionData(acctToUpdate, { parentAccountId: parentId } as any, now) as any,
            });
          }
        }
      }
    }

    // Auto-set fundBalanceAccountId to "Net Assets Without Donor Restrictions" (code 3000)
    const fundBalanceAccountId = accountMap.get('3000');
    if (fundBalanceAccountId) {
      const currentOrg = await prisma.organization.findFirst({
        where: buildCurrentVersionWhere({ id: organization.id }),
      });
      if (currentOrg && !currentOrg.fundBalanceAccountId) {
        const now = new Date();
        await closeVersion(prisma.organization, currentOrg.versionId, now, 'organization');
        await prisma.organization.create({
          data: buildNewVersionData(currentOrg, { fundBalanceAccountId } as any, now) as any,
        });
      }
    }

    return NextResponse.json({
      success: true,
      accountsCreated: template.length,
      message: `Successfully created ${template.length} accounts from template`,
    });
  } catch (error) {
    console.error('Error applying account template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
