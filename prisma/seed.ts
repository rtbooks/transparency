import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    { code: "1000", name: "Assets", type: "ASSET", parent: null },
    { code: "1100", name: "Checking Account", type: "ASSET", parent: "1000" },
    { code: "1200", name: "Savings Account", type: "ASSET", parent: "1000" },

    { code: "4000", name: "Revenue", type: "REVENUE", parent: null },
    { code: "4100", name: "Donations", type: "REVENUE", parent: "4000" },
    { code: "4200", name: "Fundraising Events", type: "REVENUE", parent: "4000" },

    { code: "5000", name: "Expenses", type: "EXPENSE", parent: null },
    { code: "5100", name: "Equipment", type: "EXPENSE", parent: "5000" },
    { code: "5200", name: "Uniforms", type: "EXPENSE", parent: "5000" },
    { code: "5300", name: "Travel", type: "EXPENSE", parent: "5000" },
    { code: "5400", name: "Facilities", type: "EXPENSE", parent: "5000" },
  ];

  const createdAccounts: Record<string, any> = {};

  for (const account of accountsData) {
    const parentAccountId = account.parent ? createdAccounts[account.parent]?.id : null;

    const created = await prisma.account.create({
      data: {
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

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
