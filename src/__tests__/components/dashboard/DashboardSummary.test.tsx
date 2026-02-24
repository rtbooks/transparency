/**
 * @jest-environment jsdom
 */

/**
 * DashboardSummary Component Tests
 * 
 * Validates that the DashboardSummary component correctly:
 * - Shows Total Assets and Total Liabilities from account balances
 * - Shows Last 30 day Revenue and Expenses from transaction totals
 * - Uses the 'currentBalance' field from API responses (NOT 'balance')
 * - Displays recent transactions
 * - Handles loading and error states
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DashboardSummary } from '@/components/dashboard/DashboardSummary';

// Mock fetch globally
global.fetch = jest.fn();

const mockTransactionsResponse = {
  transactions: [],
  pagination: { totalCount: 0, page: 1, limit: 10, totalPages: 0 },
  periodTotal: 0,
};

function mockFetchForAccounts(accounts: unknown[], overrides?: Record<string, unknown>) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/accounts')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(accounts) });
    }
    if (url.includes('/overdraft-alerts')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ alerts: [] }) });
    }
    if (url.includes('type=INCOME')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...mockTransactionsResponse, periodTotal: overrides?.revenue ?? 0 }),
      });
    }
    if (url.includes('type=EXPENSE')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...mockTransactionsResponse, periodTotal: overrides?.expenses ?? 0 }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockTransactionsResponse),
    });
  });
}

describe('DashboardSummary Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading state while fetching data', () => {
      (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
      render(<DashboardSummary organizationSlug="test-org" />);
      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      render(<DashboardSummary organizationSlug="test-org" />);
      await waitFor(() => {
        expect(screen.getByText('Error loading dashboard')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should display error message when API returns non-OK status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
      render(<DashboardSummary organizationSlug="test-org" />);
      await waitFor(() => {
        expect(screen.getByText('Error loading dashboard')).toBeInTheDocument();
        expect(screen.getByText('Failed to fetch dashboard data')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Cards', () => {
    it('should show Total Assets computed from ASSET accounts', async () => {
      mockFetchForAccounts([
        { id: '1', code: '1000', name: 'Checking', type: 'ASSET', currentBalance: 5000 },
        { id: '2', code: '1100', name: 'Savings', type: 'ASSET', currentBalance: 3000 },
        { id: '3', code: '4000', name: 'Revenue', type: 'REVENUE', currentBalance: 1000 },
      ]);

      render(<DashboardSummary organizationSlug="test-org" />);
      await waitFor(() => {
        expect(screen.getByText('Total Assets')).toBeInTheDocument();
        expect(screen.getByText('$8,000.00')).toBeInTheDocument(); // 5000 + 3000
      });
    });

    it('should show Total Liabilities computed from LIABILITY accounts', async () => {
      mockFetchForAccounts([
        { id: '1', code: '2000', name: 'AP', type: 'LIABILITY', currentBalance: 2500 },
        { id: '2', code: '1000', name: 'Cash', type: 'ASSET', currentBalance: 1000 },
      ]);

      render(<DashboardSummary organizationSlug="test-org" />);
      await waitFor(() => {
        expect(screen.getByText('Total Liabilities')).toBeInTheDocument();
        expect(screen.getByText('$2,500.00')).toBeInTheDocument();
      });
    });

    it('should show Last 30 day Revenue and Expenses from periodTotal', async () => {
      mockFetchForAccounts(
        [{ id: '1', code: '1000', name: 'Cash', type: 'ASSET', currentBalance: 1000 }],
        { revenue: 4200, expenses: 1800 }
      );

      render(<DashboardSummary organizationSlug="test-org" />);
      await waitFor(() => {
        expect(screen.getByText('Revenue')).toBeInTheDocument();
        expect(screen.getByText('Expenses')).toBeInTheDocument();
        expect(screen.getByText('$4,200.00')).toBeInTheDocument();
        expect(screen.getByText('$1,800.00')).toBeInTheDocument();
      });
    });

    it('should handle zero balance accounts correctly', async () => {
      mockFetchForAccounts([
        { id: '1', code: '1000', name: 'Empty', type: 'ASSET', currentBalance: 0 },
      ]);

      render(<DashboardSummary organizationSlug="test-org" />);
      await waitFor(() => {
        // All four cards show $0.00 (assets=0, liabilities=0, revenue=0, expenses=0)
        const zeros = screen.getAllByText(/\$0\.00/);
        expect(zeros.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should handle negative balances correctly', async () => {
      mockFetchForAccounts([
        { id: '1', code: '2000', name: 'AP', type: 'LIABILITY', currentBalance: -500 },
      ]);

      render(<DashboardSummary organizationSlug="test-org" />);
      await waitFor(() => {
        expect(screen.getByText(/-\$500\.00/)).toBeInTheDocument();
      });
    });
  });

  describe('Critical Bug Prevention', () => {
    it('should FAIL if API returns "balance" instead of "currentBalance"', async () => {
      mockFetchForAccounts([
        { id: '1', code: '1000', name: 'Checking', type: 'ASSET', balance: 5000 },
      ]);

      render(<DashboardSummary organizationSlug="test-org" />);
      await waitFor(() => {
        // With wrong field name, asset balance resolves to NaN or 0
        expect(screen.queryByText(/\$5,000\.00/)).not.toBeInTheDocument();
        // Liabilities, revenue, expenses all zero
        const zeros = screen.getAllByText(/\$0\.00/);
        expect(zeros.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should correctly use currentBalance from API response', async () => {
      mockFetchForAccounts([
        { id: '1', code: '1000', name: 'Checking', type: 'ASSET', currentBalance: 5000 },
      ]);

      render(<DashboardSummary organizationSlug="test-org" />);
      await waitFor(() => {
        expect(screen.getByText(/\$5,000\.00/)).toBeInTheDocument();
      });
    });
  });

  describe('Transaction Display', () => {
    it('should display recent transactions', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/accounts')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        if (url.includes('/overdraft-alerts')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ alerts: [] }) });
        }
        if (url.includes('type=')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...mockTransactionsResponse }),
          });
        }
        // Recent transactions
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            transactions: [
              {
                id: 'txn-1',
                transactionDate: '2024-01-15T00:00:00.000Z',
                type: 'INCOME',
                amount: 1000,
                description: 'Donation received',
                debitAccount: { code: '1000', name: 'Checking' },
                creditAccount: { code: '4000', name: 'Revenue' },
              },
            ],
            pagination: { totalCount: 1, page: 1, limit: 10, totalPages: 1 },
            periodTotal: 1000,
          }),
        });
      });

      render(<DashboardSummary organizationSlug="test-org" />);
      await waitFor(() => {
        expect(screen.getByText('Donation received')).toBeInTheDocument();
        expect(screen.getByText('Income')).toBeInTheDocument();
      });
    });
  });

  describe('API Calls', () => {
    it('should call APIs with correct organization slug', async () => {
      mockFetchForAccounts([]);

      render(<DashboardSummary organizationSlug="my-org" />);
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/organizations/my-org/accounts');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/organizations/my-org/transactions?limit=10')
        );
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/organizations/my-org/transactions?type=INCOME')
        );
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/organizations/my-org/transactions?type=EXPENSE')
        );
      });
    });
  });
});
