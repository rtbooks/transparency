import { prisma } from '../src/lib/prisma';

async function main() {
  // Find all users
  const users = await prisma.user.findMany({
    include: {
      organizations: {
        include: {
          organization: true
        }
      }
    }
  });

  console.log('Current users:');
  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name} (${user.email})`);
    console.log(`   Organizations: ${user.organizations.length}`);
    user.organizations.forEach(org => {
      console.log(`   - ${org.organization.name}: ${org.role}`);
    });
  });

  if (users.length === 0) {
    console.log('\nNo users found. Please create a user account first.');
    return;
  }

  // Get the first user (or you can modify this to select a specific user)
  const user = users[0];
  console.log(`\nUpgrading user: ${user.name} (${user.email})`);

  // Find or create a test organization
  let org = await prisma.organization.findFirst();
  
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Platform Administration',
        slug: 'platform-admin',
        fiscalYearStart: new Date('2024-01-01'),
      }
    });
    console.log(`Created organization: ${org.name}`);
  }

  // Check if user already has a relationship with this org
  const existingOrgUser = await prisma.organizationUser.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id
      }
    }
  });

  if (existingOrgUser) {
    // Update existing role
    await prisma.organizationUser.update({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: org.id
        }
      },
      data: {
        role: 'PLATFORM_ADMIN'
      }
    });
    console.log(`Updated ${user.name} to PLATFORM_ADMIN in ${org.name}`);
  } else {
    // Create new relationship
    await prisma.organizationUser.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'PLATFORM_ADMIN'
      }
    });
    console.log(`Added ${user.name} as PLATFORM_ADMIN to ${org.name}`);
  }

  console.log('\n✅ Platform administrator role granted!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
