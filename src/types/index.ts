// Export Prisma types
export type {
  Organization,
  User,
  Transaction,
  Account,
  ProgramSpending,
  OrganizationUser,
  BankAccount,
} from "@/generated/prisma/client";

// Export Prisma enums
export {
  OrganizationStatus,
  SubscriptionTier,
  UserRole,
  AccountType,
  TransactionType,
  SpendingStatus,
} from "@/generated/prisma/client";
