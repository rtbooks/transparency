/**
 * Bank Statement Parser Service
 *
 * Parses CSV and OFX/QFX bank statement files into structured line items.
 * Supports column auto-detection and configurable column mapping.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface ColumnMapping {
  date: number;          // column index for transaction date
  description: number;   // column index for description/memo
  amount?: number;       // single amount column (positive=deposit, negative=withdrawal)
  debit?: number;        // separate debit (withdrawal) column
  credit?: number;       // separate credit (deposit) column
  reference?: number;    // optional reference/check number column
  category?: number;     // optional category column
  balance?: number;      // optional running balance column (ignored for reconciliation)
  hasHeader: boolean;    // whether first row is a header
}

export interface ParsedStatementLine {
  transactionDate: Date;
  postDate?: Date;
  description: string;
  referenceNumber?: string;
  amount: number;        // positive = deposit, negative = withdrawal
  category?: string;
}

export interface ParsedStatement {
  lines: ParsedStatementLine[];
  detectedMapping?: ColumnMapping;
  warnings: string[];
}

// ── Common date patterns ────────────────────────────────────────────────

const DATE_PATTERNS = [
  // MM/DD/YYYY or MM-DD-YYYY
  { regex: /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/, parse: (m: RegExpMatchArray) => new Date(+m[3], +m[1] - 1, +m[2], 12) },
  // YYYY-MM-DD
  { regex: /^(\d{4})-(\d{2})-(\d{2})$/, parse: (m: RegExpMatchArray) => new Date(+m[1], +m[2] - 1, +m[3], 12) },
  // YYYY/MM/DD
  { regex: /^(\d{4})\/(\d{2})\/(\d{2})$/, parse: (m: RegExpMatchArray) => new Date(+m[1], +m[2] - 1, +m[3], 12) },
  // DD/MM/YYYY (less common in US, tried last)
  // We skip this to avoid ambiguity — US banks primarily use MM/DD/YYYY
];

function parseDate(value: string): Date | null {
  const trimmed = value.trim().replace(/"/g, '');
  for (const pattern of DATE_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      const d = pattern.parse(match);
      if (!isNaN(d.getTime())) return d;
    }
  }
  // Fallback: try native Date parsing
  const d = new Date(trimmed + (trimmed.length === 10 ? 'T12:00:00' : ''));
  return isNaN(d.getTime()) ? null : d;
}

function parseAmount(value: string): number | null {
  if (!value || !value.trim()) return null;
  // Remove currency symbols, commas, quotes, whitespace
  const cleaned = value.trim().replace(/["$£€,\s]/g, '');
  if (!cleaned) return null;
  // Handle parentheses as negative: (123.45) → -123.45
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  const numStr = parenMatch ? `-${parenMatch[1]}` : cleaned;
  const num = parseFloat(numStr);
  return isNaN(num) ? null : num;
}

// ── CSV Parsing ─────────────────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Header keywords for auto-detection */
const HEADER_KEYWORDS: Record<string, string[]> = {
  date: ['date', 'trans date', 'transaction date', 'posting date', 'post date', 'posted'],
  description: ['description', 'memo', 'details', 'narrative', 'payee', 'transaction description'],
  amount: ['amount', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'debit amount', 'money out'],
  credit: ['credit', 'deposit', 'deposits', 'credit amount', 'money in'],
  reference: ['reference', 'ref', 'check', 'check no', 'check number', 'ref no', 'reference number'],
  category: ['category', 'type', 'transaction type'],
  balance: ['balance', 'running balance', 'available balance'],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/**
 * Auto-detect column mapping from header row.
 */
export function detectColumnMapping(headerRow: string[]): ColumnMapping | null {
  const normalized = headerRow.map(normalizeHeader);

  const findCol = (keywords: string[]): number | undefined => {
    for (const kw of keywords) {
      const idx = normalized.findIndex((h) => h === kw || h.includes(kw));
      if (idx >= 0) return idx;
    }
    return undefined;
  };

  const dateCol = findCol(HEADER_KEYWORDS.date);
  const descCol = findCol(HEADER_KEYWORDS.description);
  if (dateCol === undefined || descCol === undefined) return null;

  const amountCol = findCol(HEADER_KEYWORDS.amount);
  const debitCol = findCol(HEADER_KEYWORDS.debit);
  const creditCol = findCol(HEADER_KEYWORDS.credit);

  // Need either a single amount column or separate debit/credit
  if (amountCol === undefined && (debitCol === undefined || creditCol === undefined)) return null;

  return {
    date: dateCol,
    description: descCol,
    amount: amountCol,
    debit: debitCol,
    credit: creditCol,
    reference: findCol(HEADER_KEYWORDS.reference),
    category: findCol(HEADER_KEYWORDS.category),
    balance: findCol(HEADER_KEYWORDS.balance),
    hasHeader: true,
  };
}

/**
 * Parse a CSV bank statement into structured line items.
 */
export function parseCsvStatement(
  csvContent: string,
  mapping?: ColumnMapping
): ParsedStatement {
  const warnings: string[] = [];
  const rawLines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (rawLines.length === 0) return { lines: [], warnings: ['Empty file'] };

  const rows = rawLines.map(splitCsvLine);

  // Auto-detect mapping from first row if not provided
  let effectiveMapping = mapping;
  let dataStartRow = 0;

  if (!effectiveMapping) {
    effectiveMapping = detectColumnMapping(rows[0]) ?? undefined;
    if (effectiveMapping) {
      dataStartRow = 1; // skip header
    } else {
      warnings.push('Could not auto-detect column mapping from header row');
      return { lines: [], detectedMapping: undefined, warnings };
    }
  } else if (effectiveMapping.hasHeader) {
    dataStartRow = 1;
  }

  const lines: ParsedStatementLine[] = [];

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= 1 && !row[0]?.trim()) continue; // skip empty rows

    const dateVal = row[effectiveMapping.date];
    const date = dateVal ? parseDate(dateVal) : null;
    if (!date) {
      warnings.push(`Row ${i + 1}: invalid date "${dateVal}"`);
      continue;
    }

    const description = row[effectiveMapping.description]?.replace(/"/g, '').trim() || '';
    if (!description) {
      warnings.push(`Row ${i + 1}: empty description`);
      continue;
    }

    let amount: number;
    if (effectiveMapping.amount !== undefined) {
      // Single amount column
      const parsed = parseAmount(row[effectiveMapping.amount]);
      if (parsed === null) {
        warnings.push(`Row ${i + 1}: invalid amount "${row[effectiveMapping.amount]}"`);
        continue;
      }
      amount = parsed;
    } else {
      // Separate debit/credit columns
      const debit = parseAmount(row[effectiveMapping.debit!] || '');
      const credit = parseAmount(row[effectiveMapping.credit!] || '');
      if (debit === null && credit === null) {
        warnings.push(`Row ${i + 1}: no debit or credit amount`);
        continue;
      }
      // Debit = withdrawal (negative), Credit = deposit (positive)
      amount = (credit || 0) - (debit || 0);
    }

    const line: ParsedStatementLine = {
      transactionDate: date,
      description,
      amount,
    };

    if (effectiveMapping.reference !== undefined) {
      const ref = row[effectiveMapping.reference]?.replace(/"/g, '').trim();
      if (ref) line.referenceNumber = ref;
    }

    if (effectiveMapping.category !== undefined) {
      const cat = row[effectiveMapping.category]?.replace(/"/g, '').trim();
      if (cat) line.category = cat;
    }

    lines.push(line);
  }

  return { lines, detectedMapping: effectiveMapping, warnings };
}

// ── OFX/QFX Parsing ────────────────────────────────────────────────────

/**
 * Parse an OFX/QFX file into structured line items.
 * OFX uses SGML-like tags (not strict XML).
 */
export function parseOfxStatement(content: string): ParsedStatement {
  const warnings: string[] = [];
  const lines: ParsedStatementLine[] = [];

  // Extract STMTTRN blocks (each is one transaction)
  const txnBlocks = content.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];

  if (txnBlocks.length === 0) {
    warnings.push('No transactions found in OFX file');
    return { lines, warnings };
  }

  for (const block of txnBlocks) {
    const getTag = (tag: string): string | undefined => {
      const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
      return match?.[1]?.trim();
    };

    // Date: DTPOSTED format is YYYYMMDD or YYYYMMDDHHMMSS
    const dtPosted = getTag('DTPOSTED');
    if (!dtPosted) {
      warnings.push('Transaction missing DTPOSTED');
      continue;
    }
    const year = parseInt(dtPosted.substring(0, 4));
    const month = parseInt(dtPosted.substring(4, 6)) - 1;
    const day = parseInt(dtPosted.substring(6, 8));
    const transactionDate = new Date(year, month, day, 12);
    if (isNaN(transactionDate.getTime())) {
      warnings.push(`Invalid OFX date: ${dtPosted}`);
      continue;
    }

    // Amount: TRNAMT
    const trnAmt = getTag('TRNAMT');
    const amount = trnAmt ? parseFloat(trnAmt) : null;
    if (amount === null || isNaN(amount)) {
      warnings.push(`Invalid OFX amount: ${trnAmt}`);
      continue;
    }

    // Description: NAME or MEMO
    const name = getTag('NAME') || getTag('MEMO') || 'Unknown';

    const line: ParsedStatementLine = {
      transactionDate,
      description: name,
      amount,
    };

    // Reference: CHECKNUM or FITID
    const checkNum = getTag('CHECKNUM');
    const fitId = getTag('FITID');
    if (checkNum) line.referenceNumber = checkNum;
    else if (fitId) line.referenceNumber = fitId;

    // Category from TRNTYPE (DEBIT, CREDIT, CHECK, etc.)
    const trnType = getTag('TRNTYPE');
    if (trnType) line.category = trnType;

    lines.push(line);
  }

  return { lines, warnings };
}

/**
 * Detect file format and parse accordingly.
 */
export function parseStatement(
  content: string,
  fileName: string,
  mapping?: ColumnMapping
): ParsedStatement {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'ofx' || ext === 'qfx') {
    return parseOfxStatement(content);
  }
  return parseCsvStatement(content, mapping);
}
