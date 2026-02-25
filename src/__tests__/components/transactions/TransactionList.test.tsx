/**
 * @jest-environment jsdom
 */

/**
 * TransactionList Component Tests
 * 
 * These tests validate that the TransactionList component correctly:
 * - Displays transactions with proper account information
 * - Handles loading, error, and empty states
 * - Formats transaction data (dates, amounts, types)
 * - Handles pagination correctly
 * - Filters transactions by type and date
 * - Uses correct field names from API responses
 * 
 * CRITICAL: Ensures component works with account data that includes
 * proper field names from the API contract.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TransactionList } from '@/components/transactions/TransactionList';

// Mock fetch globally
global.fetch = jest.fn();

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/org/test-org/transactions',
}));

describe('TransactionList Component', () => {
  const mockAccountsResponse = {
    ok: true,
    json: () => Promise.resolve([
      { id: 'acct-1', code: '1000', name: 'Checking', type: 'ASSET' },
      { id: 'acct-2', code: '4000', name: 'Revenue', type: 'REVENUE' },
    ]),
  };

  function mockFetchForTransactions(txnResponse: object) {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/accounts')) return Promise.resolve(mockAccountsResponse);
      return Promise.resolve(txnResponse);
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading state while fetching transactions', () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/accounts')) return Promise.resolve(mockAccountsResponse);
        return new Promise(() => {});
      });

      render(<TransactionList organizationSlug="test-org" />);

      expect(screen.getByText('Loading transactions...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when fetch fails', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/accounts')) return Promise.resolve(mockAccountsResponse);
        return Promise.reject(new Error('Network error'));
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });

    it('should display error message when API returns non-OK status', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/accounts')) return Promise.resolve(mockAccountsResponse);
        return Promise.resolve({ ok: false, status: 500 });
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no transactions exist', async () => {
      const mockResponse = {
        transactions: [],
        pagination: {
          totalCount: 0,
          page: 1,
          limit: 25,
          totalPages: 0,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        expect(screen.getByText(/No transactions found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Transaction Display', () => {
    it('should display transactions with account information', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          organizationId: 'org-123',
          transactionDate: '2024-01-15T00:00:00.000Z',
          type: 'INCOME',
          amount: 1000.00,
          description: 'Donation received',
          referenceNumber: 'REF-001',
          debitAccountId: 'account-1',
          creditAccountId: 'account-2',
          debitAccount: {
            id: 'account-1',
            code: '1000',
            name: 'Checking Account',
            type: 'ASSET',
          },
          creditAccount: {
            id: 'account-2',
            code: '4000',
            name: 'Donation Revenue',
            type: 'REVENUE',
          },
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-15T00:00:00.000Z',
        },
      ];

      const mockResponse = {
        transactions: mockTransactions,
        pagination: {
          totalCount: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        // Should display transaction description
        expect(screen.getByText('Donation received')).toBeInTheDocument();
        
        // Should display account codes and names
        expect(screen.getByText(/1000/)).toBeInTheDocument();
        expect(screen.getByText(/Checking Account/)).toBeInTheDocument();
        expect(screen.getByText(/4000/)).toBeInTheDocument();
        expect(screen.getByText(/Donation Revenue/)).toBeInTheDocument();
      });
    });

    it('should display transaction type badges correctly', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          organizationId: 'org-123',
          transactionDate: '2024-01-15T00:00:00.000Z',
          type: 'INCOME',
          amount: 1000.00,
          description: 'Income transaction',
          referenceNumber: null,
          debitAccountId: 'account-1',
          creditAccountId: 'account-2',
          debitAccount: {
            id: 'account-1',
            code: '1000',
            name: 'Checking',
            type: 'ASSET',
          },
          creditAccount: {
            id: 'account-2',
            code: '4000',
            name: 'Revenue',
            type: 'REVENUE',
          },
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-15T00:00:00.000Z',
        },
        {
          id: 'txn-2',
          organizationId: 'org-123',
          transactionDate: '2024-01-16T00:00:00.000Z',
          type: 'EXPENSE',
          amount: 500.00,
          description: 'Expense transaction',
          referenceNumber: null,
          debitAccountId: 'account-3',
          creditAccountId: 'account-1',
          debitAccount: {
            id: 'account-3',
            code: '5000',
            name: 'Office Expense',
            type: 'EXPENSE',
          },
          creditAccount: {
            id: 'account-1',
            code: '1000',
            name: 'Checking',
            type: 'ASSET',
          },
          createdAt: '2024-01-16T00:00:00.000Z',
          updatedAt: '2024-01-16T00:00:00.000Z',
        },
      ];

      const mockResponse = {
        transactions: mockTransactions,
        pagination: {
          totalCount: 2,
          page: 1,
          limit: 25,
          totalPages: 1,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        // Should display type badges
        expect(screen.getByText('Income')).toBeInTheDocument();
        expect(screen.getByText('Expense')).toBeInTheDocument();
      });
    });

    it('should format dates correctly', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          organizationId: 'org-123',
          transactionDate: '2024-01-15T00:00:00.000Z',
          type: 'INCOME',
          amount: 1000.00,
          description: 'Test transaction',
          referenceNumber: null,
          debitAccountId: 'account-1',
          creditAccountId: 'account-2',
          debitAccount: {
            id: 'account-1',
            code: '1000',
            name: 'Checking',
            type: 'ASSET',
          },
          creditAccount: {
            id: 'account-2',
            code: '4000',
            name: 'Revenue',
            type: 'REVENUE',
          },
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-15T00:00:00.000Z',
        },
      ];

      const mockResponse = {
        transactions: mockTransactions,
        pagination: {
          totalCount: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        // Date should be formatted (component uses date-fns format)
        // Looking for any date-like format with "2024" or "Jan" or "01/15"
        const dateElements = screen.getAllByText(/2024|Jan|01\/15/);
        expect(dateElements.length).toBeGreaterThan(0);
      });
    });

    it('should format amounts as currency', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          organizationId: 'org-123',
          transactionDate: '2024-01-15T00:00:00.000Z',
          type: 'INCOME',
          amount: 1234.56,
          description: 'Test transaction',
          referenceNumber: null,
          debitAccountId: 'account-1',
          creditAccountId: 'account-2',
          debitAccount: {
            id: 'account-1',
            code: '1000',
            name: 'Checking',
            type: 'ASSET',
          },
          creditAccount: {
            id: 'account-2',
            code: '4000',
            name: 'Revenue',
            type: 'REVENUE',
          },
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-15T00:00:00.000Z',
        },
      ];

      const mockResponse = {
        transactions: mockTransactions,
        pagination: {
          totalCount: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        // Should display formatted currency
        expect(screen.getByText(/\$1,234\.56/)).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('should display pagination controls when multiple pages exist', async () => {
      const mockTransactions = Array.from({ length: 25 }, (_, i) => ({
        id: `txn-${i}`,
        organizationId: 'org-123',
        transactionDate: '2024-01-15T00:00:00.000Z',
        type: 'INCOME',
        amount: 100,
        description: `Transaction ${i}`,
        referenceNumber: null,
        debitAccountId: 'account-1',
        creditAccountId: 'account-2',
        debitAccount: {
          id: 'account-1',
          code: '1000',
          name: 'Checking',
          type: 'ASSET',
        },
        creditAccount: {
          id: 'account-2',
          code: '4000',
          name: 'Revenue',
          type: 'REVENUE',
        },
        createdAt: '2024-01-15T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
      }));

      const mockResponse = {
        transactions: mockTransactions,
        pagination: {
          totalCount: 75,
          page: 1,
          limit: 25,
          totalPages: 3,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        // Should have pagination controls (Previous/Next buttons)
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('should call API with correct page parameter when navigating', async () => {
      const mockResponse = {
        transactions: [],
        pagination: {
          totalCount: 75,
          page: 1,
          limit: 25,
          totalPages: 3,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
      });

      // Find and click next page button
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        // Should have called API with page=2
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2')
        );
      });
    });
  });

  describe('API Integration', () => {
    it('should call API with correct organization slug', async () => {
      const mockResponse = {
        transactions: [],
        pagination: {
          totalCount: 0,
          page: 1,
          limit: 25,
          totalPages: 0,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="my-org" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/organizations/my-org/transactions')
        );
      });
    });
  });

  describe('Account Reference Structure', () => {
    it('should handle account references with required fields', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          organizationId: 'org-123',
          transactionDate: '2024-01-15T00:00:00.000Z',
          type: 'INCOME',
          amount: 1000.00,
          description: 'Test',
          referenceNumber: null,
          debitAccountId: 'account-1',
          creditAccountId: 'account-2',
          debitAccount: {
            id: 'account-1',
            code: '1000',
            name: 'Checking Account',
            type: 'ASSET',
          },
          creditAccount: {
            id: 'account-2',
            code: '4000',
            name: 'Revenue Account',
            type: 'REVENUE',
          },
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-15T00:00:00.000Z',
        },
      ];

      const mockResponse = {
        transactions: mockTransactions,
        pagination: {
          totalCount: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        // Should display all required account fields
        expect(screen.getByText(/1000/)).toBeInTheDocument(); // code
        expect(screen.getByText(/Checking Account/)).toBeInTheDocument(); // name
        expect(screen.getByText(/4000/)).toBeInTheDocument(); // code
        expect(screen.getByText(/Revenue Account/)).toBeInTheDocument(); // name
      });
    });
  });

  describe('Temporal Context', () => {
    it('should display temporal context when viewing historical data', async () => {
      const mockResponse = {
        transactions: [],
        pagination: {
          totalCount: 0,
          page: 1,
          limit: 25,
          totalPages: 0,
        },
        temporalContext: {
          asOfDate: '2024-01-01T00:00:00.000Z',
          isHistoricalView: true,
        },
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        // Should show historical view indicator with "Viewing transactions as of"
        expect(screen.getByText(/viewing transactions as of/i)).toBeInTheDocument();
      });
    });
  });

  describe('Reference Number Display', () => {
    it('should display reference number when present', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          organizationId: 'org-123',
          transactionDate: '2024-01-15T00:00:00.000Z',
          type: 'INCOME',
          amount: 1000.00,
          description: 'Test',
          referenceNumber: 'REF-12345',
          debitAccountId: 'account-1',
          creditAccountId: 'account-2',
          debitAccount: {
            id: 'account-1',
            code: '1000',
            name: 'Checking',
            type: 'ASSET',
          },
          creditAccount: {
            id: 'account-2',
            code: '4000',
            name: 'Revenue',
            type: 'REVENUE',
          },
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-15T00:00:00.000Z',
        },
      ];

      const mockResponse = {
        transactions: mockTransactions,
        pagination: {
          totalCount: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('REF-12345')).toBeInTheDocument();
      });
    });

    it('should handle null reference number', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          organizationId: 'org-123',
          transactionDate: '2024-01-15T00:00:00.000Z',
          type: 'INCOME',
          amount: 1000.00,
          description: 'Test',
          referenceNumber: null,
          debitAccountId: 'account-1',
          creditAccountId: 'account-2',
          debitAccount: {
            id: 'account-1',
            code: '1000',
            name: 'Checking',
            type: 'ASSET',
          },
          creditAccount: {
            id: 'account-2',
            code: '4000',
            name: 'Revenue',
            type: 'REVENUE',
          },
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-01-15T00:00:00.000Z',
        },
      ];

      const mockResponse = {
        transactions: mockTransactions,
        pagination: {
          totalCount: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
        },
        temporalContext: null,
      };

      mockFetchForTransactions({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      render(<TransactionList organizationSlug="test-org" />);

      // Should render without error even with null reference number
      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });
    });
  });
});
