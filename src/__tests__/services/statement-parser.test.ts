/**
 * Statement Parser Tests
 *
 * Tests CSV and OFX parsing with various bank export formats:
 * - Column auto-detection from headers
 * - Single amount column (positive/negative)
 * - Separate debit/credit columns
 * - Various date formats (MM/DD/YYYY, YYYY-MM-DD)
 * - Amount formats (negative, parentheses, currency symbols)
 * - OFX/QFX parsing
 * - Edge cases (empty rows, missing fields, malformed data)
 */

import {
  parseCsvStatement,
  parseOfxStatement,
  detectColumnMapping,
  parseStatement,
} from '@/services/statement-parser.service';

// ── Column Auto-Detection ───────────────────────────────────────────────

describe('detectColumnMapping', () => {
  it('should detect standard bank CSV headers', () => {
    const headers = ['Date', 'Description', 'Amount', 'Balance'];
    const mapping = detectColumnMapping(headers);
    expect(mapping).not.toBeNull();
    expect(mapping!.date).toBe(0);
    expect(mapping!.description).toBe(1);
    expect(mapping!.amount).toBe(2);
    expect(mapping!.hasHeader).toBe(true);
  });

  it('should detect separate debit/credit columns', () => {
    const headers = ['Transaction Date', 'Details', 'Debit', 'Credit', 'Balance'];
    const mapping = detectColumnMapping(headers);
    expect(mapping).not.toBeNull();
    expect(mapping!.date).toBe(0);
    expect(mapping!.description).toBe(1);
    expect(mapping!.debit).toBe(2);
    expect(mapping!.credit).toBe(3);
    expect(mapping!.amount).toBeUndefined();
  });

  it('should detect reference/check number column', () => {
    const headers = ['Date', 'Check No', 'Description', 'Amount'];
    const mapping = detectColumnMapping(headers);
    expect(mapping).not.toBeNull();
    expect(mapping!.reference).toBe(1);
  });

  it('should return null when required columns are missing', () => {
    const headers = ['Foo', 'Bar', 'Baz'];
    const mapping = detectColumnMapping(headers);
    expect(mapping).toBeNull();
  });

  it('should return null when no amount-related column found', () => {
    const headers = ['Date', 'Description'];
    const mapping = detectColumnMapping(headers);
    expect(mapping).toBeNull();
  });
});

// ── CSV Parsing ─────────────────────────────────────────────────────────

describe('parseCsvStatement', () => {
  it('should parse a standard CSV with single amount column', () => {
    const csv = [
      'Date,Description,Amount,Balance',
      '01/15/2026,Direct Deposit,2500.00,5000.00',
      '01/16/2026,Electric Bill,-150.00,4850.00',
      '01/17/2026,Check #1234,-75.50,4774.50',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(3);
    expect(result.warnings).toHaveLength(0);

    expect(result.lines[0].amount).toBe(2500);
    expect(result.lines[0].description).toBe('Direct Deposit');

    expect(result.lines[1].amount).toBe(-150);
    expect(result.lines[1].description).toBe('Electric Bill');

    expect(result.lines[2].amount).toBe(-75.5);
  });

  it('should parse CSV with separate debit/credit columns', () => {
    const csv = [
      'Transaction Date,Details,Debit,Credit',
      '2026-01-15,Payroll,,2500.00',
      '2026-01-16,Rent,1200.00,',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(2);

    // Credit = deposit = positive
    expect(result.lines[0].amount).toBe(2500);
    // Debit = withdrawal = negative
    expect(result.lines[1].amount).toBe(-1200);
  });

  it('should handle parenthesized negative amounts', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2026,Wire Transfer,(500.00)',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].amount).toBe(-500);
  });

  it('should handle currency symbols and commas in amounts', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2026,Large Deposit,"$1,250.75"',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].amount).toBe(1250.75);
  });

  it('should handle MM/DD/YYYY date format', () => {
    const csv = [
      'Date,Description,Amount',
      '12/31/2025,Year End Transfer,100.00',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].transactionDate.getFullYear()).toBe(2025);
    expect(result.lines[0].transactionDate.getMonth()).toBe(11); // December
    expect(result.lines[0].transactionDate.getDate()).toBe(31);
  });

  it('should handle YYYY-MM-DD date format', () => {
    const csv = [
      'Date,Description,Amount',
      '2026-03-15,Spring Payment,200.00',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].transactionDate.getMonth()).toBe(2); // March
    expect(result.lines[0].transactionDate.getDate()).toBe(15);
  });

  it('should skip empty rows', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2026,Payment,100.00',
      '',
      '01/16/2026,Deposit,200.00',
      '   ',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(2);
  });

  it('should warn on invalid dates', () => {
    const csv = [
      'Date,Description,Amount',
      'not-a-date,Payment,100.00',
      '01/15/2026,Valid,200.00',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('invalid date');
  });

  it('should warn on empty descriptions', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2026,,100.00',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(0);
    expect(result.warnings).toContain('Row 2: empty description');
  });

  it('should accept explicit column mapping', () => {
    const csv = [
      'Col A,Col B,Col C',
      '01/15/2026,My Payment,500',
    ].join('\n');

    const result = parseCsvStatement(csv, {
      date: 0,
      description: 1,
      amount: 2,
      hasHeader: true,
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].description).toBe('My Payment');
    expect(result.lines[0].amount).toBe(500);
  });

  it('should return empty with warning when auto-detection fails', () => {
    const csv = [
      'Foo,Bar,Baz',
      'a,b,c',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(0);
    expect(result.warnings).toContain('Could not auto-detect column mapping from header row');
  });

  it('should handle quoted CSV fields with commas', () => {
    const csv = [
      'Date,Description,Amount',
      '01/15/2026,"Smith, John - Invoice #123",750.00',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].description).toBe('Smith, John - Invoice #123');
  });

  it('should extract reference and category columns when present', () => {
    const csv = [
      'Date,Reference,Description,Amount,Category',
      '01/15/2026,CHK1234,Check Payment,-500.00,Bills',
    ].join('\n');

    const result = parseCsvStatement(csv);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].referenceNumber).toBe('CHK1234');
    expect(result.lines[0].category).toBe('Bills');
  });
});

// ── OFX Parsing ─────────────────────────────────────────────────────────

describe('parseOfxStatement', () => {
  const sampleOfx = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260115
<TRNAMT>-150.00
<FITID>2026011501
<NAME>Electric Company
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260116
<TRNAMT>2500.00
<FITID>2026011601
<NAME>Direct Deposit
<CHECKNUM>5678
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

  it('should parse OFX transactions', () => {
    const result = parseOfxStatement(sampleOfx);
    expect(result.lines).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
  });

  it('should parse amounts correctly (negative = withdrawal)', () => {
    const result = parseOfxStatement(sampleOfx);
    expect(result.lines[0].amount).toBe(-150);
    expect(result.lines[1].amount).toBe(2500);
  });

  it('should parse dates from YYYYMMDD format', () => {
    const result = parseOfxStatement(sampleOfx);
    expect(result.lines[0].transactionDate.getFullYear()).toBe(2026);
    expect(result.lines[0].transactionDate.getMonth()).toBe(0); // January
    expect(result.lines[0].transactionDate.getDate()).toBe(15);
  });

  it('should extract descriptions from NAME tag', () => {
    const result = parseOfxStatement(sampleOfx);
    expect(result.lines[0].description).toBe('Electric Company');
    expect(result.lines[1].description).toBe('Direct Deposit');
  });

  it('should extract check numbers when present', () => {
    const result = parseOfxStatement(sampleOfx);
    expect(result.lines[0].referenceNumber).toBe('2026011501'); // FITID fallback
    expect(result.lines[1].referenceNumber).toBe('5678'); // CHECKNUM preferred
  });

  it('should extract transaction type as category', () => {
    const result = parseOfxStatement(sampleOfx);
    expect(result.lines[0].category).toBe('DEBIT');
    expect(result.lines[1].category).toBe('CREDIT');
  });

  it('should warn when no transactions found', () => {
    const result = parseOfxStatement('<OFX></OFX>');
    expect(result.lines).toHaveLength(0);
    expect(result.warnings).toContain('No transactions found in OFX file');
  });
});

// ── parseStatement (format detection) ───────────────────────────────────

describe('parseStatement', () => {
  it('should detect CSV by file extension', () => {
    const csv = 'Date,Description,Amount\n01/15/2026,Test,100';
    const result = parseStatement(csv, 'statement.csv');
    expect(result.lines).toHaveLength(1);
  });

  it('should detect OFX by file extension', () => {
    const ofx = '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260115<TRNAMT>-50<NAME>Test</STMTTRN>';
    const result = parseStatement(ofx, 'download.ofx');
    expect(result.lines).toHaveLength(1);
  });

  it('should detect QFX by file extension', () => {
    const qfx = '<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260120<TRNAMT>300<NAME>Deposit</STMTTRN>';
    const result = parseStatement(qfx, 'quicken.qfx');
    expect(result.lines).toHaveLength(1);
  });

  it('should default to CSV parsing for unknown extensions', () => {
    const csv = 'Date,Description,Amount\n01/15/2026,Test,100';
    const result = parseStatement(csv, 'data.txt');
    expect(result.lines).toHaveLength(1);
  });
});
