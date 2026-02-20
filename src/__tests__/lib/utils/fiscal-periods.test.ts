import {
  getFiscalYearForDate,
  getFiscalQuarter,
  getFiscalMonth,
  getPeriodBoundaries,
  getPriorPeriod,
  listFiscalYears,
  listFiscalQuarters,
  listFiscalMonths,
} from '@/lib/utils/fiscal-periods';

describe('fiscal-periods', () => {
  // Calendar year fiscal year (Jan 1)
  const calendarFYStart = new Date(Date.UTC(2024, 0, 1));
  // Mid-year fiscal year (Jul 1)
  const julyFYStart = new Date(Date.UTC(2024, 6, 1));

  describe('getFiscalYearForDate', () => {
    it('should return calendar year for Jan 1 fiscal start', () => {
      const result = getFiscalYearForDate(
        calendarFYStart,
        new Date(Date.UTC(2025, 5, 15))
      );
      expect(result.fiscalYearLabel).toBe('FY 2025');
      expect(result.start.getUTCFullYear()).toBe(2025);
      expect(result.start.getUTCMonth()).toBe(0);
    });

    it('should return correct fiscal year for July start, date in Oct', () => {
      const result = getFiscalYearForDate(
        julyFYStart,
        new Date(Date.UTC(2025, 9, 15)) // October 2025
      );
      expect(result.fiscalYearLabel).toBe('FY 2025-2026');
      expect(result.start.getUTCMonth()).toBe(6); // July
      expect(result.start.getUTCFullYear()).toBe(2025);
    });

    it('should return prior fiscal year for July start, date in March', () => {
      const result = getFiscalYearForDate(
        julyFYStart,
        new Date(Date.UTC(2025, 2, 15)) // March 2025
      );
      expect(result.fiscalYearLabel).toBe('FY 2024-2025');
      expect(result.start.getUTCFullYear()).toBe(2024);
      expect(result.start.getUTCMonth()).toBe(6);
    });

    it('should handle date exactly on fiscal year start', () => {
      const result = getFiscalYearForDate(
        julyFYStart,
        new Date(Date.UTC(2025, 6, 1)) // Jul 1 2025
      );
      expect(result.fiscalYearLabel).toBe('FY 2025-2026');
      expect(result.start.getUTCFullYear()).toBe(2025);
    });
  });

  describe('getFiscalQuarter', () => {
    it('should return Q1 for date in first quarter of calendar FY', () => {
      const result = getFiscalQuarter(
        calendarFYStart,
        new Date(Date.UTC(2025, 1, 15)) // Feb 2025
      );
      expect(result.quarter).toBe(1);
      expect(result.label).toContain('Q1');
    });

    it('should return Q3 for Oct in July fiscal year', () => {
      const result = getFiscalQuarter(
        julyFYStart,
        new Date(Date.UTC(2025, 0, 15)) // Jan 2025 = Q3 of FY Jul 2024
      );
      expect(result.quarter).toBe(3);
    });

    it('should return Q1 for August in July fiscal year', () => {
      const result = getFiscalQuarter(
        julyFYStart,
        new Date(Date.UTC(2025, 7, 15)) // Aug 2025
      );
      expect(result.quarter).toBe(1);
    });
  });

  describe('getFiscalMonth', () => {
    it('should return correct month boundaries', () => {
      const result = getFiscalMonth(
        calendarFYStart,
        new Date(Date.UTC(2025, 5, 15)) // June 2025
      );
      expect(result.label).toBe('June 2025');
      expect(result.start.getUTCMonth()).toBe(5);
    });
  });

  describe('getPeriodBoundaries', () => {
    it('should return year boundaries', () => {
      const result = getPeriodBoundaries(
        calendarFYStart,
        new Date(Date.UTC(2025, 5, 15)),
        'year'
      );
      expect(result.label).toBe('FY 2025');
      expect(result.startDate.getUTCFullYear()).toBe(2025);
      expect(result.startDate.getUTCMonth()).toBe(0);
    });

    it('should return quarter boundaries', () => {
      const result = getPeriodBoundaries(
        calendarFYStart,
        new Date(Date.UTC(2025, 5, 15)),
        'quarter'
      );
      expect(result.label).toContain('Q2');
    });

    it('should return month boundaries', () => {
      const result = getPeriodBoundaries(
        calendarFYStart,
        new Date(Date.UTC(2025, 5, 15)),
        'month'
      );
      expect(result.label).toBe('June 2025');
    });
  });

  describe('getPriorPeriod', () => {
    it('should return prior year', () => {
      const current = getPeriodBoundaries(
        calendarFYStart,
        new Date(Date.UTC(2025, 5, 15)),
        'year'
      );
      const prior = getPriorPeriod(calendarFYStart, current, 'year');
      expect(prior.label).toBe('FY 2024');
    });

    it('should return prior quarter', () => {
      const current = getPeriodBoundaries(
        calendarFYStart,
        new Date(Date.UTC(2025, 5, 15)),
        'quarter'
      );
      const prior = getPriorPeriod(calendarFYStart, current, 'quarter');
      expect(prior.label).toContain('Q1');
    });

    it('should return prior month', () => {
      const current = getPeriodBoundaries(
        calendarFYStart,
        new Date(Date.UTC(2025, 5, 15)),
        'month'
      );
      const prior = getPriorPeriod(calendarFYStart, current, 'month');
      expect(prior.label).toBe('May 2025');
    });
  });

  describe('listFiscalYears', () => {
    it('should list fiscal years from org creation to now', () => {
      const orgCreated = new Date(Date.UTC(2023, 3, 1));
      const now = new Date(Date.UTC(2025, 5, 15));
      const years = listFiscalYears(calendarFYStart, orgCreated, now);
      expect(years.length).toBe(3); // 2023, 2024, 2025
      expect(years[0].label).toBe('FY 2023');
      expect(years[2].label).toBe('FY 2025');
    });
  });

  describe('listFiscalQuarters', () => {
    it('should list 4 quarters for a fiscal year', () => {
      const fy = getFiscalYearForDate(
        calendarFYStart,
        new Date(Date.UTC(2025, 5, 15))
      );
      const quarters = listFiscalQuarters(calendarFYStart, fy.start);
      expect(quarters.length).toBe(4);
      expect(quarters[0].quarter).toBe(1);
      expect(quarters[3].quarter).toBe(4);
    });
  });

  describe('listFiscalMonths', () => {
    it('should list 12 months for a fiscal year', () => {
      const fy = getFiscalYearForDate(
        calendarFYStart,
        new Date(Date.UTC(2025, 5, 15))
      );
      const months = listFiscalMonths(calendarFYStart, fy.start);
      expect(months.length).toBe(12);
      expect(months[0].label).toContain('January');
      expect(months[11].label).toContain('December');
    });

    it('should start from July for July fiscal year', () => {
      const fy = getFiscalYearForDate(
        julyFYStart,
        new Date(Date.UTC(2025, 8, 15))
      );
      const months = listFiscalMonths(julyFYStart, fy.start);
      expect(months.length).toBe(12);
      expect(months[0].label).toContain('July');
      expect(months[11].label).toContain('June');
    });
  });
});
