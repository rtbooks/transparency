import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function addUserToGrit() {
  try {
    console.log("🔍 Finding most recent user...");

    // Find the most recently created user (should be you)
    const user = await prisma.user.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!user) {
      console.error("❌ No users found in database");
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name} (${user.email})`);

    // Find GRIT Hoops organization
    const grit = await prisma.organization.findUnique({
      where: { slug: "grit-hoops" },
    });

    if (!grit) {
      console.error("❌ GRIT Hoops organization not found");
      process.exit(1);
    }

    console.log(`✅ Found organization: ${grit.name}`);

    // Check if user is already a member
    const existingMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: grit.id,
        },
      },
    });

    if (existingMembership) {
      console.log(`✅ User is already a member with role: ${existingMembership.role}`);
      process.exit(0);
    }

    // Add user as ORG_ADMIN
    const membership = await prisma.organizationUser.create({
      data: {
        userId: user.id,
        organizationId: grit.id,
        role: "ORG_ADMIN",
      },
    });

    console.log(`🎉 Successfully added ${user.name} to ${grit.name} as ORG_ADMIN`);
    console.log(`\n✅ You can now access: http://localhost:3000/grit-hoops/dashboard`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addUserToGrit();
