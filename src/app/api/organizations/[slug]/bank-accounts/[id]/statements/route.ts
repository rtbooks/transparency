import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { parseStatement } from '@/services/statement-parser.service';
import { z } from 'zod';

const uploadSchema = z.object({
  statementDate: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  openingBalance: z.number().optional(),
  closingBalance: z.number().optional(),
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

    // Derive period dates from parsed transaction dates if not provided
    const txDates = parsed.lines.map((l) => l.transactionDate.getTime());
    const minDate = new Date(Math.min(...txDates));
    const maxDate = new Date(Math.max(...txDates));

    const periodStart = validated.periodStart ? safeDateParse(validated.periodStart) : minDate;
    const periodEnd = validated.periodEnd ? safeDateParse(validated.periodEnd) : maxDate;
    const statementDate = validated.statementDate ? safeDateParse(validated.statementDate) : maxDate;

    // Create statement and lines in a transaction (with deduplication)
    let duplicatesSkipped = 0;
    const statement = await prisma.$transaction(async (tx) => {
      const stmt = await tx.bankStatement.create({
        data: {
          organizationId: organization.id,
          bankAccountId,
          statementDate,
          periodStart,
          periodEnd,
          openingBalance: validated.openingBalance ?? 0,
          closingBalance: validated.closingBalance ?? 0,
          fileName: validated.fileName,
          status: 'DRAFT',
        },
      });

      // Deduplicate: check existing lines for this bank account
      const existingLines = await tx.bankStatementLine.findMany({
        where: {
          bankStatement: { bankAccountId },
        },
        select: {
          transactionDate: true,
          amount: true,
          description: true,
        },
      });

      // Build a set of existing line fingerprints for fast lookup
      const existingFingerprints = new Set(
        existingLines.map((l) =>
          `${l.transactionDate.toISOString().slice(0, 10)}|${Number(l.amount).toFixed(2)}|${l.description.trim().toLowerCase()}`
        )
      );

      // Filter out duplicates
      const newLines = parsed.lines.filter((line) => {
        const fingerprint = `${line.transactionDate.toISOString().slice(0, 10)}|${Number(line.amount).toFixed(2)}|${line.description.trim().toLowerCase()}`;
        if (existingFingerprints.has(fingerprint)) {
          duplicatesSkipped++;
          return false;
        }
        // Add to set so we don't import duplicates within the same file
        existingFingerprints.add(fingerprint);
        return true;
      });

      // Create statement lines (only non-duplicates)
      if (newLines.length > 0) {
        await tx.bankStatementLine.createMany({
          data: newLines.map((line) => ({
            bankStatementId: stmt.id,
            transactionDate: line.transactionDate,
            description: line.description,
            referenceNumber: line.referenceNumber || null,
            amount: line.amount,
            category: line.category || null,
          })),
        });
      }

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
      linesImported: parsed.lines.length - duplicatesSkipped,
      duplicatesSkipped,
      totalParsed: parsed.lines.length,
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
