import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { parseStatement } from '@/services/statement-parser.service';
import { z } from 'zod';

const uploadSchema = z.object({
  statementDate: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  openingBalance: z.number(),
  closingBalance: z.number(),
  fileName: z.string(),
  fileContent: z.string(),       // base64 or raw CSV/OFX content
  columnMapping: z.object({
    date: z.number(),
    description: z.number(),
    amount: z.number().optional(),
    debit: z.number().optional(),
    credit: z.number().optional(),
    reference: z.number().optional(),
    category: z.number().optional(),
    balance: z.number().optional(),
    hasHeader: z.boolean(),
  }).optional(),
});

/**
 * GET /api/organizations/[slug]/bank-accounts/[id]/statements
 * List bank statements for a bank account.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: bankAccountId } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const statements = await prisma.bankStatement.findMany({
      where: { organizationId: organization.id, bankAccountId },
      include: {
        _count: { select: { lines: true } },
      },
      orderBy: { statementDate: 'desc' },
    });

    // Add match summary counts
    const statementsWithCounts = await Promise.all(
      statements.map(async (stmt) => {
        const lineCounts = await prisma.bankStatementLine.groupBy({
          by: ['status'],
          where: { bankStatementId: stmt.id },
          _count: true,
        });
        const counts: Record<string, number> = {};
        for (const g of lineCounts) counts[g.status] = g._count;
        return { ...stmt, lineCounts: counts };
      })
    );

    return NextResponse.json(statementsWithCounts);
  } catch (error) {
    console.error('Error listing statements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/bank-accounts/[id]/statements
 * Upload and parse a bank statement.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: bankAccountId } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    // Verify bank account belongs to this org
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
    if (!bankAccount || bankAccount.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = uploadSchema.parse(body);

    // Parse the statement file
    const parsed = parseStatement(validated.fileContent, validated.fileName, validated.columnMapping);

    if (parsed.lines.length === 0) {
      return NextResponse.json(
        { error: 'No transactions found in file', warnings: parsed.warnings },
        { status: 400 }
      );
    }

    const safeDateParse = (s: string) => new Date(s.length === 10 ? s + 'T12:00:00' : s);

    // Create statement and lines in a transaction
    const statement = await prisma.$transaction(async (tx) => {
      const stmt = await tx.bankStatement.create({
        data: {
          organizationId: organization.id,
          bankAccountId,
          statementDate: safeDateParse(validated.statementDate),
          periodStart: safeDateParse(validated.periodStart),
          periodEnd: safeDateParse(validated.periodEnd),
          openingBalance: validated.openingBalance,
          closingBalance: validated.closingBalance,
          fileName: validated.fileName,
          status: 'DRAFT',
        },
      });

      // Create statement lines
      await tx.bankStatementLine.createMany({
        data: parsed.lines.map((line) => ({
          bankStatementId: stmt.id,
          transactionDate: line.transactionDate,
          description: line.description,
          referenceNumber: line.referenceNumber || null,
          amount: line.amount,
          category: line.category || null,
        })),
      });

      // Save column mapping to bank account for future imports
      if (parsed.detectedMapping && !bankAccount.csvColumnMapping) {
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: { csvColumnMapping: parsed.detectedMapping as any },
        });
      }

      return stmt;
    });

    // Fetch the created statement with line count
    const result = await prisma.bankStatement.findUnique({
      where: { id: statement.id },
      include: { _count: { select: { lines: true } } },
    });

    return NextResponse.json({
      statement: result,
      linesImported: parsed.lines.length,
      warnings: parsed.warnings,
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error uploading statement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
