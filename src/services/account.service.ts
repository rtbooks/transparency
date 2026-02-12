/**
 * Account Service
 * Business logic for chart of accounts operations with temporal versioning
 */

import { prisma } from '@/lib/prisma';
import { TemporalRepository } from '@/lib/temporal/temporal-repository';
import { buildCurrentVersionWhere, MAX_DATE } from '@/lib/temporal/temporal-utils';
import type { Account, AccountType, Prisma } from '@/generated/prisma/client';

const accountRepo = new TemporalRepository<Account>(prisma, 'account');

export interface CreateAccountInput {
  organizationId: string;
  code: string;
  name: string;
  type: AccountType;
  description?: string | null;
  parentAccountId?: string | null;
  isActive?: boolean;
  createdByUserId: string;
}

export interface UpdateAccountInput {
  code?: string;
  name?: string;
  type?: AccountType;
  description?: string | null;
  parentAccountId?: string | null;
  isActive?: boolean;
  currentBalance?: Prisma.Decimal;
}

/**
 * Create a new account (initial version)
 */
export async function createAccount(
  input: CreateAccountInput
): Promise<Account> {
  const now = new Date();

  return await prisma.account.create({
    data: {
      organizationId: input.organizationId,
      code: input.code,
      name: input.name,
      type: input.type,
      description: input.description,
      parentAccountId: input.parentAccountId,
      isActive: input.isActive ?? true,
      currentBalance: 0,
      
      // Temporal fields (initial version)
      versionId: crypto.randomUUID(),
      previousVersionId: null,
      validFrom: now,
      validTo: MAX_DATE,
      systemFrom: now,
      systemTo: MAX_DATE,
      isDeleted: false,
      changedBy: input.createdByUserId,
    },
  });
}

/**
 * Find current version of account by ID
 */
export async function findAccountById(
  id: string
): Promise<Account | null> {
  return await accountRepo.findCurrentById(id);
}

/**
 * Find all current accounts for an organization
 */
export async function findAccountsByOrganization(
  organizationId: string
): Promise<Account[]> {
  return await accountRepo.findAllCurrent({ organizationId });
}

/**
 * Find active accounts only
 */
export async function findActiveAccounts(
  organizationId: string
): Promise<Account[]> {
  return await prisma.account.findMany({
    where: buildCurrentVersionWhere({
      organizationId,
      isActive: true,
    }),
    orderBy: { code: 'asc' },
  });
}

/**
 * Update account (creates new version)
 */
export async function updateAccount(
  id: string,
  updates: UpdateAccountInput,
  userId: string
): Promise<Account> {
  return await accountRepo.update(id, updates, userId);
}

/**
 * Soft delete account (mark as inactive and deleted)
 */
export async function deleteAccount(
  id: string,
  userId: string
): Promise<Account> {
  // First update to set isActive = false, then soft delete
  const account = await accountRepo.findCurrentById(id);
  if (!account) {
    throw new Error('Account not found');
  }

  if (account.isActive) {
    await accountRepo.update(id, { isActive: false }, userId);
  }

  return await accountRepo.softDelete(id, userId);
}

/**
 * Toggle account active status (creates new version)
 */
export async function toggleAccountActive(
  id: string,
  userId: string
): Promise<Account> {
  const account = await accountRepo.findCurrentById(id);
  if (!account) {
    throw new Error('Account not found');
  }

  return await accountRepo.update(
    id,
    { isActive: !account.isActive },
    userId
  );
}

/**
 * Get account version history
 */
export async function getAccountHistory(
  id: string
): Promise<Account[]> {
  return await accountRepo.findHistory(id);
}

/**
 * Get account as it was at a specific date
 */
export async function getAccountAsOf(
  id: string,
  asOfDate: Date
): Promise<Account | null> {
  return await accountRepo.findAsOf(id, asOfDate);
}

/**
 * Check if account code is available within organization
 */
export async function isAccountCodeAvailable(
  organizationId: string,
  code: string,
  excludeAccountId?: string
): Promise<boolean> {
  const existing = await prisma.account.findFirst({
    where: buildCurrentVersionWhere({
      organizationId,
      code,
      ...(excludeAccountId && { id: { not: excludeAccountId } }),
    }),
  });
  return !existing;
}

/**
 * Get account hierarchy (current versions only)
 */
export async function getAccountHierarchy(
  organizationId: string
): Promise<Account[]> {
  const accounts = await findAccountsByOrganization(organizationId);
  
  // Build tree structure (can be enhanced with recursive logic if needed)
  return accounts.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Update account balance (for cached balance field)
 * This creates a new version with updated balance
 */
export async function updateAccountBalance(
  accountId: string,
  newBalance: Prisma.Decimal,
  userId: string
): Promise<Account> {
  return await accountRepo.update(
    accountId,
    { currentBalance: newBalance },
    userId
  );
}

/**
 * Get accounts by type for an organization
 */
export async function getAccountsByType(
  organizationId: string,
  type: AccountType
): Promise<Account[]> {
  return await prisma.account.findMany({
    where: buildCurrentVersionWhere({
      organizationId,
      type,
    }),
    orderBy: { code: 'asc' },
  });
}
