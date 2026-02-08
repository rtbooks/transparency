/**
 * Test Hierarchical Account Relationships
 * 
 * This script tests the account hierarchy functionality:
 * 1. Parent-child relationships
 * 2. Circular reference prevention
 * 3. Descendant as parent prevention
 * 4. Account type matching
 * 5. Activation/deactivation rules
 * 6. Hierarchical balance calculations
 */

import { prisma } from '../src/lib/prisma';
import { calculateHierarchicalBalance } from '../src/lib/accounting/balance-verification';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('🧪 Starting Hierarchical Account Relationship Tests...\n');

  try {
    // Find the test organization
    const org = await prisma.organization.findFirst({
      where: { slug: 'grit-hoops' },
    });

    if (!org) {
      console.error('❌ Test organization not found. Please ensure grit-hoops exists.');
      process.exit(1);
    }

    console.log(`✅ Found test organization: ${org.name}\n`);

    // Test 1: Verify parent-child relationships exist
    await testParentChildRelationships(org.id);

    // Test 2: Verify account type consistency
    await testAccountTypeConsistency(org.id);

    // Test 3: Test circular reference prevention
    await testCircularReferencePrevention(org.id);

    // Test 4: Test descendant as parent prevention
    await testDescendantAsParentPrevention(org.id);

    // Test 5: Test activation rules with hierarchy
    await testActivationRules(org.id);

    // Test 6: Test hierarchical balance calculations
    await testHierarchicalBalances(org.id);

    // Test 7: Test account code generation for children
    await testAccountCodeGeneration(org.id);

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60) + '\n');

    let passedCount = 0;
    let failedCount = 0;

    results.forEach((result) => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}`);
      console.log(`   ${result.message}\n`);
      
      if (result.passed) passedCount++;
      else failedCount++;
    });

    console.log('='.repeat(60));
    console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
    console.log('='.repeat(60) + '\n');

    if (failedCount === 0) {
      console.log('🎉 All hierarchical relationship tests passed!\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Please review the results above.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function testParentChildRelationships(orgId: string) {
  try {
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId },
      include: {
        childAccounts: true,
        parentAccount: true,
      },
    });

    const parentsWithChildren = accounts.filter(a => a.childAccounts.length > 0);
    const childrenWithParents = accounts.filter(a => a.parentAccountId !== null);

    results.push({
      name: 'Parent-Child Relationships',
      passed: parentsWithChildren.length > 0 && childrenWithParents.length > 0,
      message: `Found ${parentsWithChildren.length} parent accounts with children, ${childrenWithParents.length} child accounts with parents`,
    });

    // Verify bidirectional relationships
    let relationshipErrors = 0;
    for (const child of childrenWithParents) {
      const parent = parentsWithChildren.find(p => p.id === child.parentAccountId);
      if (!parent) {
        relationshipErrors++;
      } else {
        const parentHasChild = parent.childAccounts.some(c => c.id === child.id);
        if (!parentHasChild) {
          relationshipErrors++;
        }
      }
    }

    results.push({
      name: 'Bidirectional Relationship Integrity',
      passed: relationshipErrors === 0,
      message: relationshipErrors === 0
        ? 'All parent-child relationships are bidirectional'
        : `Found ${relationshipErrors} relationship inconsistencies`,
    });
  } catch (error) {
    results.push({
      name: 'Parent-Child Relationships',
      passed: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function testAccountTypeConsistency(orgId: string) {
  try {
    const accounts = await prisma.account.findMany({
      where: {
        organizationId: orgId,
        parentAccountId: { not: null },
      },
      include: {
        parentAccount: true,
      },
    });

    let typeErrors = 0;
    const errorDetails: string[] = [];

    for (const account of accounts) {
      if (account.parentAccount && account.type !== account.parentAccount.type) {
        typeErrors++;
        errorDetails.push(
          `${account.code} (${account.type}) has parent ${account.parentAccount.code} (${account.parentAccount.type})`
        );
      }
    }

    results.push({
      name: 'Account Type Consistency',
      passed: typeErrors === 0,
      message: typeErrors === 0
        ? 'All child accounts match their parent account types'
        : `Found ${typeErrors} type mismatches: ${errorDetails.join(', ')}`,
    });
  } catch (error) {
    results.push({
      name: 'Account Type Consistency',
      passed: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function testCircularReferencePrevention(orgId: string) {
  try {
    // This tests that no account is its own ancestor
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId },
    });

    let circularErrors = 0;

    for (const account of accounts) {
      const visited = new Set<string>();
      let currentId = account.parentAccountId;

      while (currentId) {
        if (visited.has(currentId)) {
          circularErrors++;
          break;
        }
        if (currentId === account.id) {
          circularErrors++;
          break;
        }
        visited.add(currentId);

        const parent = accounts.find(a => a.id === currentId);
        currentId = parent?.parentAccountId || null;
      }
    }

    results.push({
      name: 'Circular Reference Prevention',
      passed: circularErrors === 0,
      message: circularErrors === 0
        ? 'No circular references detected in account hierarchy'
        : `Found ${circularErrors} circular references`,
    });
  } catch (error) {
    results.push({
      name: 'Circular Reference Prevention',
      passed: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function testDescendantAsParentPrevention(orgId: string) {
  try {
    // Verify no account has a descendant as its parent
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId },
    });

    let descendantErrors = 0;

    const getDescendants = (accountId: string, visited = new Set<string>()): Set<string> => {
      if (visited.has(accountId)) return visited;
      visited.add(accountId);

      const children = accounts.filter(a => a.parentAccountId === accountId);
      for (const child of children) {
        getDescendants(child.id, visited);
      }

      return visited;
    };

    for (const account of accounts) {
      if (account.parentAccountId) {
        const descendants = getDescendants(account.id);
        if (descendants.has(account.parentAccountId)) {
          descendantErrors++;
        }
      }
    }

    results.push({
      name: 'Descendant as Parent Prevention',
      passed: descendantErrors === 0,
      message: descendantErrors === 0
        ? 'No accounts have descendants as parents'
        : `Found ${descendantErrors} cases of descendants as parents`,
    });
  } catch (error) {
    results.push({
      name: 'Descendant as Parent Prevention',
      passed: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function testActivationRules(orgId: string) {
  try {
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId },
      include: {
        childAccounts: true,
        parentAccount: true,
      },
    });

    let activationErrors = 0;
    const errorDetails: string[] = [];

    // Rule 1: Inactive parent should have inactive children
    for (const account of accounts) {
      if (!account.isActive && account.childAccounts.length > 0) {
        const activeChildren = account.childAccounts.filter(c => c.isActive);
        if (activeChildren.length > 0) {
          activationErrors++;
          errorDetails.push(
            `Inactive parent ${account.code} has ${activeChildren.length} active children`
          );
        }
      }
    }

    // Rule 2: Active child should have active parent
    for (const account of accounts) {
      if (account.isActive && account.parentAccount && !account.parentAccount.isActive) {
        activationErrors++;
        errorDetails.push(
          `Active account ${account.code} has inactive parent ${account.parentAccount.code}`
        );
      }
    }

    results.push({
      name: 'Activation/Deactivation Rules',
      passed: activationErrors === 0,
      message: activationErrors === 0
        ? 'All activation rules are properly enforced'
        : `Found ${activationErrors} activation rule violations: ${errorDetails.join('; ')}`,
    });
  } catch (error) {
    results.push({
      name: 'Activation/Deactivation Rules',
      passed: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function testHierarchicalBalances(orgId: string) {
  try {
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId },
      include: {
        childAccounts: true,
      },
    });

    const parentsWithChildren = accounts.filter(a => a.childAccounts.length > 0);

    if (parentsWithChildren.length === 0) {
      results.push({
        name: 'Hierarchical Balance Calculations',
        passed: true,
        message: 'No parent accounts with children to test (skipped)',
      });
      return;
    }

    // Test the calculateHierarchicalBalance function
    let calculationErrors = 0;
    const errors: string[] = [];

    for (const parent of parentsWithChildren.slice(0, 3)) { // Test first 3 parents
      try {
        const hierarchicalBalance = calculateHierarchicalBalance(parent.id, accounts);
        
        // Calculate expected balance manually - only sum direct children's own balances
        // NOT including their descendants since the parent includes all descendants recursively
        let expectedBalance = Number(parent.currentBalance);
        
        // Get all descendants recursively
        const getDescendantBalances = (parentId: string): number => {
          const children = accounts.filter(a => a.parentAccountId === parentId);
          let sum = 0;
          for (const child of children) {
            sum += Number(child.currentBalance);
            sum += getDescendantBalances(child.id);
          }
          return sum;
        };
        
        expectedBalance += getDescendantBalances(parent.id);

        // Allow for small floating point differences
        const difference = Math.abs(hierarchicalBalance - expectedBalance);
        if (difference > 0.01) {
          calculationErrors++;
          errors.push(
            `Account ${parent.code}: calculated=${hierarchicalBalance.toFixed(2)}, expected=${expectedBalance.toFixed(2)}, diff=${difference.toFixed(2)}`
          );
        }
      } catch (error) {
        calculationErrors++;
        errors.push(`Account ${parent.code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    results.push({
      name: 'Hierarchical Balance Calculations',
      passed: calculationErrors === 0,
      message: calculationErrors === 0
        ? `Tested ${Math.min(3, parentsWithChildren.length)} parent accounts, all balances calculated correctly`
        : `Found ${calculationErrors} balance calculation errors: ${errors.join('; ')}`,
    });
  } catch (error) {
    results.push({
      name: 'Hierarchical Balance Calculations',
      passed: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function testAccountCodeGeneration(orgId: string) {
  try {
    const accounts = await prisma.account.findMany({
      where: {
        organizationId: orgId,
        parentAccountId: { not: null },
      },
      include: {
        parentAccount: true,
      },
    });

    let codeErrors = 0;
    const errorDetails: string[] = [];

    for (const account of accounts) {
      if (account.parentAccount) {
        const parentCode = parseInt(account.parentAccount.code);
        const childCode = parseInt(account.code);

        // Child code should start with parent code
        if (!account.code.startsWith(account.parentAccount.code.charAt(0))) {
          codeErrors++;
          errorDetails.push(
            `Child ${account.code} doesn't match parent ${account.parentAccount.code} type prefix`
          );
        }

        // Child code should be greater than parent code
        if (childCode <= parentCode) {
          codeErrors++;
          errorDetails.push(
            `Child code ${account.code} should be greater than parent ${account.parentAccount.code}`
          );
        }
      }
    }

    results.push({
      name: 'Account Code Generation',
      passed: codeErrors === 0,
      message: codeErrors === 0
        ? 'All child account codes follow proper numbering conventions'
        : `Found ${codeErrors} code generation issues: ${errorDetails.slice(0, 3).join('; ')}`,
    });
  } catch (error) {
    results.push({
      name: 'Account Code Generation',
      passed: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

// Run the tests
runTests();
