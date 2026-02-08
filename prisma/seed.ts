import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create GRIT Hoops organization
  const grit = await prisma.organization.upsert({
    where: { slug: "grit-hoops" },
    update: {},
    create: {
      name: "GRIT Hoops Westwood Basketball, Inc",
      slug: "grit-hoops",
      ein: "12-3456789",
      mission: "Supporting Westwood High School girls basketball program",
      fiscalYearStart: new Date("2024-01-01"),
      status: "ACTIVE",
      subscriptionTier: "FREE",
    },
  });

  console.log("✅ Created organization:", grit.name);

  // Create chart of accounts for GRIT
  const accountsData = [
    // ASSETS
    { code: "1000", name: "Assets", type: "ASSET", parent: null },
    { code: "1100", name: "Current Assets", type: "ASSET", parent: "1000" },
    { code: "1110", name: "Checking Account", type: "ASSET", parent: "1100" },
    { code: "1120", name: "Savings Account", type: "ASSET", parent: "1100" },
    { code: "1130", name: "Cash on Hand", type: "ASSET", parent: "1100" },

    // LIABILITIES
    { code: "2000", name: "Liabilities", type: "LIABILITY", parent: null },
    { code: "2100", name: "Current Liabilities", type: "LIABILITY", parent: "2000" },
    { code: "2110", name: "Accounts Payable", type: "LIABILITY", parent: "2100" },

    // EQUITY
    { code: "3000", name: "Net Assets", type: "EQUITY", parent: null },
    { code: "3100", name: "Unrestricted Net Assets", type: "EQUITY", parent: "3000" },

    // REVENUE
    { code: "4000", name: "Revenue", type: "REVENUE", parent: null },
    { code: "4100", name: "Donation Income", type: "REVENUE", parent: "4000" },
    { code: "4200", name: "Program Revenue", type: "REVENUE", parent: "4000" },
    { code: "4300", name: "Fundraising Revenue", type: "REVENUE", parent: "4000" },

    // EXPENSES
    { code: "5000", name: "Expenses", type: "EXPENSE", parent: null },
    { code: "5100", name: "Program Expenses", type: "EXPENSE", parent: "5000" },
    { code: "5110", name: "Equipment & Uniforms", type: "EXPENSE", parent: "5100" },
    { code: "5120", name: "Facility Rental", type: "EXPENSE", parent: "5100" },
    { code: "5130", name: "Coach Compensation", type: "EXPENSE", parent: "5100" },
    { code: "5200", name: "Administrative Expenses", type: "EXPENSE", parent: "5000" },
    { code: "5210", name: "Office Supplies", type: "EXPENSE", parent: "5200" },
    { code: "5220", name: "Insurance", type: "EXPENSE", parent: "5200" },
    { code: "5230", name: "Website & Technology", type: "EXPENSE", parent: "5200" },
  ];

  const createdAccounts: Record<string, any> = {};

  for (const account of accountsData) {
    const parentAccountId = account.parent
      ? createdAccounts[account.parent]?.id
      : null;

    const created = await prisma.account.upsert({
      where: {
        organizationId_code: {
          organizationId: grit.id,
          code: account.code,
        },
      },
      update: {},
      create: {
        organizationId: grit.id,
        code: account.code,
        name: account.name,
        type: account.type as any,
        parentAccountId,
      },
    });

    createdAccounts[account.code] = created;
    console.log("✅ Created account:", account.name);
  }

  // Create sample transactions
  const transactions = [
    {
      transactionDate: new Date("2024-01-15"),
      description: "Initial deposit - Opening balance",
      amount: 5000.0,
      type: "INCOME" as const,
      paymentMethod: "BANK_TRANSFER" as const,
      debitAccountId: createdAccounts["1110"].id,
      creditAccountId: createdAccounts["4100"].id,
      referenceNumber: "INIT-001",
    },
    {
      transactionDate: new Date("2024-02-01"),
      description: "Donation from community supporter",
      amount: 500.0,
      type: "INCOME" as const,
      paymentMethod: "STRIPE" as const,
      debitAccountId: createdAccounts["1110"].id,
      creditAccountId: createdAccounts["4100"].id,
      referenceNumber: "DON-001",
      donorName: "John Doe",
    },
    {
      transactionDate: new Date("2024-02-05"),
      description: "Purchase basketballs and training equipment",
      amount: 350.0,
      type: "EXPENSE" as const,
      paymentMethod: "CHECK" as const,
      debitAccountId: createdAccounts["5110"].id,
      creditAccountId: createdAccounts["1110"].id,
      referenceNumber: "EXP-001",
      category: "Equipment",
    },
    {
      transactionDate: new Date("2024-02-10"),
      description: "Winter camp registration fees",
      amount: 1200.0,
      type: "INCOME" as const,
      paymentMethod: "STRIPE" as const,
      debitAccountId: createdAccounts["1110"].id,
      creditAccountId: createdAccounts["4200"].id,
      referenceNumber: "REV-001",
      category: "Programs",
    },
    {
      transactionDate: new Date("2024-02-15"),
      description: "Gym rental - February",
      amount: 800.0,
      type: "EXPENSE" as const,
      paymentMethod: "BANK_TRANSFER" as const,
      debitAccountId: createdAccounts["5120"].id,
      creditAccountId: createdAccounts["1110"].id,
      referenceNumber: "EXP-002",
      category: "Facilities",
    },
    {
      transactionDate: new Date("2024-02-20"),
      description: "Donation - Anonymous supporter",
      amount: 250.0,
      type: "INCOME" as const,
      paymentMethod: "CASH" as const,
      debitAccountId: createdAccounts["1110"].id,
      creditAccountId: createdAccounts["4100"].id,
      referenceNumber: "DON-002",
      isAnonymous: true,
    },
  ];

  for (const txn of transactions) {
    await prisma.transaction.create({
      data: {
        ...txn,
        organizationId: grit.id,
      },
    });
  }

  console.log(`✅ Created ${transactions.length} sample transactions`);

  // Create a planned purchase
  await prisma.plannedPurchase.create({
    data: {
      organizationId: grit.id,
      title: "New Basketball Court Flooring",
      description:
        "Replace worn court flooring at practice facility to ensure player safety",
      estimatedAmount: 8500.0,
      priority: "HIGH",
      status: "PLANNED",
      category: "Equipment",
    },
  });

  console.log("✅ Created sample planned purchase");

  // Recalculate account balances
  await recalculateBalances(grit.id);

  console.log("🎉 Seeding complete!");
}

async function recalculateBalances(organizationId: string) {
  const accounts = await prisma.account.findMany({
    where: { organizationId },
  });

  for (const account of accounts) {
    const debits = await prisma.transaction.aggregate({
      where: { organizationId, debitAccountId: account.id },
      _sum: { amount: true },
    });

    const credits = await prisma.transaction.aggregate({
      where: { organizationId, creditAccountId: account.id },
      _sum: { amount: true },
    });

    const debitSum = debits._sum.amount || 0;
    const creditSum = credits._sum.amount || 0;

    let balance = 0;
    if (account.type === "ASSET" || account.type === "EXPENSE") {
      balance = Number(debitSum) - Number(creditSum);
    } else {
      balance = Number(creditSum) - Number(debitSum);
    }

    await prisma.account.update({
      where: { id: account.id },
      data: { currentBalance: balance },
    });
  }

  console.log("✅ Recalculated account balances");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
