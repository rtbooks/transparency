/**
 * Fiscal Period Utilities
 * Compute fiscal year/quarter/month boundaries from Organization.fiscalYearStart
 */

export type PeriodGranularity = 'year' | 'quarter' | 'month';

export interface FiscalPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
}

/**
 * Get the fiscal year start for a given calendar date.
 * E.g., if fiscalYearStart month is July (7) and the date is March 2025,
 * the fiscal year started July 2024.
 */
export function getFiscalYearForDate(
  fiscalYearStartDate: Date,
  referenceDate: Date
): { fiscalYearLabel: string; start: Date; end: Date } {
  const fyStartMonth = fiscalYearStartDate.getUTCMonth(); // 0-indexed
  const fyStartDay = fiscalYearStartDate.getUTCDate();
  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();
  const refDay = referenceDate.getUTCDate();

  // Determine which fiscal year the reference date falls in
  let fyStartYear: number;
  if (fyStartMonth === 0 && fyStartDay === 1) {
    // Calendar year fiscal year
    fyStartYear = refYear;
  } else if (
    refMonth > fyStartMonth ||
    (refMonth === fyStartMonth && refDay >= fyStartDay)
  ) {
    fyStartYear = refYear;
  } else {
    fyStartYear = refYear - 1;
  }

  const start = new Date(Date.UTC(fyStartYear, fyStartMonth, fyStartDay));
  const end = new Date(Date.UTC(fyStartYear + 1, fyStartMonth, fyStartDay, 0, 0, 0, -1));

  const endCalendarYear = fyStartMonth === 0 && fyStartDay === 1
    ? fyStartYear
    : fyStartYear + 1;

  const label = fyStartMonth === 0 && fyStartDay === 1
    ? `FY ${fyStartYear}`
    : `FY ${fyStartYear}-${endCalendarYear}`;

  return { fiscalYearLabel: label, start, end };
}

/**
 * Get the fiscal quarter for a given date within a fiscal year.
 */
export function getFiscalQuarter(
  fiscalYearStartDate: Date,
  referenceDate: Date
): { quarter: number; start: Date; end: Date; label: string } {
  const fy = getFiscalYearForDate(fiscalYearStartDate, referenceDate);
  const fyStartMonth = fy.start.getUTCMonth();
  const fyStartDay = fy.start.getUTCDate();
  const fyStartYear = fy.start.getUTCFullYear();

  // Calculate which quarter the reference date falls in
  const refMonth = referenceDate.getUTCMonth();
  const refYear = referenceDate.getUTCFullYear();
  const monthsFromStart =
    (refYear - fyStartYear) * 12 + (refMonth - fyStartMonth);
  const quarter = Math.min(Math.floor(monthsFromStart / 3) + 1, 4);

  const qStartMonth = fyStartMonth + (quarter - 1) * 3;
  const qStartYear = fyStartYear + Math.floor(qStartMonth / 12);
  const qStartMonthNormalized = qStartMonth % 12;

  const qEndMonth = fyStartMonth + quarter * 3;
  const qEndYear = fyStartYear + Math.floor(qEndMonth / 12);
  const qEndMonthNormalized = qEndMonth % 12;

  const start = new Date(Date.UTC(qStartYear, qStartMonthNormalized, fyStartDay));
  const end = new Date(Date.UTC(qEndYear, qEndMonthNormalized, fyStartDay, 0, 0, 0, -1));

  return {
    quarter,
    start,
    end,
    label: `Q${quarter} ${fy.fiscalYearLabel}`,
  };
}

/**
 * Get the fiscal month period for a given date.
 */
export function getFiscalMonth(
  fiscalYearStartDate: Date,
  referenceDate: Date
): { monthIndex: number; start: Date; end: Date; label: string } {
  const refMonth = referenceDate.getUTCMonth();
  const refYear = referenceDate.getUTCFullYear();
  const fyStartDay = fiscalYearStartDate.getUTCDate();

  const start = new Date(Date.UTC(refYear, refMonth, fyStartDay));
  const nextMonth = refMonth + 1;
  const nextYear = refYear + Math.floor(nextMonth / 12);
  const nextMonthNormalized = nextMonth % 12;
  const end = new Date(Date.UTC(nextYear, nextMonthNormalized, fyStartDay, 0, 0, 0, -1));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return {
    monthIndex: refMonth,
    start,
    end,
    label: `${monthNames[refMonth]} ${refYear}`,
  };
}

/**
 * Get the period boundaries for a given granularity.
 */
export function getPeriodBoundaries(
  fiscalYearStartDate: Date,
  referenceDate: Date,
  granularity: PeriodGranularity
): FiscalPeriod {
  switch (granularity) {
    case 'year': {
      const fy = getFiscalYearForDate(fiscalYearStartDate, referenceDate);
      return { startDate: fy.start, endDate: fy.end, label: fy.fiscalYearLabel };
    }
    case 'quarter': {
      const q = getFiscalQuarter(fiscalYearStartDate, referenceDate);
      return { startDate: q.start, endDate: q.end, label: q.label };
    }
    case 'month': {
      const m = getFiscalMonth(fiscalYearStartDate, referenceDate);
      return { startDate: m.start, endDate: m.end, label: m.label };
    }
  }
}

/**
 * Get the prior period (same granularity, one step back).
 */
export function getPriorPeriod(
  fiscalYearStartDate: Date,
  currentPeriod: FiscalPeriod,
  granularity: PeriodGranularity
): FiscalPeriod {
  let priorRef: Date;
  switch (granularity) {
    case 'year':
      priorRef = new Date(currentPeriod.startDate);
      priorRef.setUTCFullYear(priorRef.getUTCFullYear() - 1);
      break;
    case 'quarter':
      priorRef = new Date(currentPeriod.startDate);
      priorRef.setUTCMonth(priorRef.getUTCMonth() - 3);
      break;
    case 'month':
      priorRef = new Date(currentPeriod.startDate);
      priorRef.setUTCMonth(priorRef.getUTCMonth() - 1);
      break;
  }
  return getPeriodBoundaries(fiscalYearStartDate, priorRef, granularity);
}

/**
 * List available fiscal years from org creation to now.
 */
export function listFiscalYears(
  fiscalYearStartDate: Date,
  orgCreatedAt: Date,
  now: Date = new Date()
): Array<{ label: string; start: Date; end: Date }> {
  const years: Array<{ label: string; start: Date; end: Date }> = [];
  const firstFY = getFiscalYearForDate(fiscalYearStartDate, orgCreatedAt);
  const lastFY = getFiscalYearForDate(fiscalYearStartDate, now);

  let currentStart = firstFY.start;
  while (currentStart <= lastFY.start) {
    const fy = getFiscalYearForDate(fiscalYearStartDate, currentStart);
    years.push({ label: fy.fiscalYearLabel, start: fy.start, end: fy.end });
    // Move to next fiscal year
    currentStart = new Date(Date.UTC(
      currentStart.getUTCFullYear() + 1,
      currentStart.getUTCMonth(),
      currentStart.getUTCDate()
    ));
  }

  return years;
}

/**
 * List fiscal quarters for a given fiscal year.
 */
export function listFiscalQuarters(
  fiscalYearStartDate: Date,
  fiscalYearStart: Date
): Array<{ quarter: number; label: string; start: Date; end: Date }> {
  const quarters: Array<{ quarter: number; label: string; start: Date; end: Date }> = [];
  for (let q = 0; q < 4; q++) {
    const ref = new Date(fiscalYearStart);
    ref.setUTCMonth(ref.getUTCMonth() + q * 3);
    const quarter = getFiscalQuarter(fiscalYearStartDate, ref);
    quarters.push(quarter);
  }
  return quarters;
}

/**
 * List fiscal months for a given fiscal year.
 */
export function listFiscalMonths(
  fiscalYearStartDate: Date,
  fiscalYearStart: Date
): Array<{ label: string; start: Date; end: Date }> {
  const months: Array<{ label: string; start: Date; end: Date }> = [];
  for (let m = 0; m < 12; m++) {
    const ref = new Date(fiscalYearStart);
    ref.setUTCMonth(ref.getUTCMonth() + m);
    const month = getFiscalMonth(fiscalYearStartDate, ref);
    months.push({ label: month.label, start: month.start, end: month.end });
  }
  return months;
}
