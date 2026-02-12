# Contributing to Financial Transparency Platform

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Expected Behavior

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Bug Report Template:**
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
 - OS: [e.g., Ubuntu 22.04]
 - Browser: [e.g., Chrome 120]
 - Version: [e.g., 1.0.0]

**Additional context**
Any other context about the problem.
```

### Suggesting Features

Feature suggestions are welcome! Please create an issue with the following:

**Feature Request Template:**
```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other solutions you've thought about.

**Use case**
Who would benefit and how?

**Additional context**
Mockups, examples, etc.
```

### Pull Requests

**IMPORTANT: The `main` branch is protected. All changes MUST go through a branch and pull request.**

#### Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   # or: fix/bug-description, docs/update-readme, etc.
   ```

2. **Make your changes** following our coding standards
3. **Add tests** if applicable
4. **Update documentation** if needed
5. **Ensure tests pass**: `npm test`
6. **Commit your changes** with clear messages (see format below)
7. **Push to your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create a Pull Request** on GitHub:
   - Target the `main` branch
   - Fill out the PR template
   - Request review from maintainers
   - Address any review comments

9. **After approval**, a maintainer will merge your PR

#### Branch Naming Convention

Use descriptive branch names with prefixes:
- `feature/` - New features (e.g., `feature/bulk-transaction-import`)
- `fix/` - Bug fixes (e.g., `fix/donation-webhook-signature`)
- `docs/` - Documentation updates (e.g., `docs/update-deployment-guide`)
- `refactor/` - Code refactoring (e.g., `refactor/account-tree-component`)
- `test/` - Test additions/updates (e.g., `test/add-accounting-tests`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

#### Pull Request Guidelines

- Keep changes focused - one feature/fix per PR
- Write clear commit messages (see below)
- Update relevant documentation
- Add tests for new features
- Ensure all tests pass
- Follow the existing code style
- Link related issues in PR description

#### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(transactions): add bulk transaction import

Allow organization admins to import multiple transactions
from CSV files, matching against chart of accounts.

Closes #123
```

```
fix(donations): correct Stripe webhook signature verification

The webhook was failing in production due to incorrect
signature validation. Now properly validates signatures.

Fixes #456
```

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Git

### Setup Steps

1. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/transparency-platform.git
   cd transparency-platform
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Set up database:**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Avoid `any` types - use proper typing
- Use interfaces for object shapes
- Use enums for fixed sets of values

**Good:**
```typescript
interface Transaction {
  id: string;
  amount: number;
  date: Date;
}

function createTransaction(data: Transaction): Promise<Transaction> {
  // ...
}
```

**Bad:**
```typescript
function createTransaction(data: any): any {
  // ...
}
```

### ⚠️ CRITICAL: Prisma Client Imports

**ALWAYS use the correct import path for PrismaClient:**

```typescript
// ✅ CORRECT - Use this
import { PrismaClient } from '@/generated/prisma/client';
import { Organization, Account, UserRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

// ❌ WRONG - Will break Vercel builds
import { PrismaClient } from '@/generated/prisma';
import { PrismaClient } from '@prisma/client';
```

**Why:** Our Prisma schema uses a custom output directory (`output = "../src/generated/prisma"`), so imports must include the `/client` suffix. Using the wrong path will cause TypeScript compilation errors in Vercel deployments.

**Before committing Prisma-related changes:**
1. Verify the import path is correct
2. Run `npm run type-check` 
3. Run `npm run build` to ensure it compiles
4. Check existing code for the correct pattern

See `COPILOT_GUIDELINES.md` for more details.

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use TypeScript props interfaces
- Extract reusable logic into custom hooks

**Good:**
```typescript
interface TransactionCardProps {
  transaction: Transaction;
  onEdit: (id: string) => void;
}

export function TransactionCard({ transaction, onEdit }: TransactionCardProps) {
  return (
    <Card>
      <CardHeader>{transaction.description}</CardHeader>
      <CardContent>${transaction.amount}</CardContent>
    </Card>
  );
}
```

### File Organization

- One component per file
- Co-locate related files
- Use index files for cleaner imports
- Keep files under 300 lines

### Naming Conventions

- **Components**: PascalCase (`TransactionList.tsx`)
- **Files**: kebab-case for utilities (`format-currency.ts`)
- **Variables**: camelCase (`totalAmount`)
- **Constants**: UPPER_CASE (`MAX_TRANSACTIONS`)
- **Types/Interfaces**: PascalCase (`TransactionType`)

### CSS/Styling

- Use Tailwind utility classes
- Create reusable components with Shadcn/ui
- Avoid inline styles
- Use CSS modules for complex custom styles

### API Routes

- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Return consistent response formats
- Include proper error handling
- Validate input with Zod

**Example:**
```typescript
// app/api/transactions/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    
    const transaction = await createTransaction(data);
    
    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Run E2E tests
npm test:e2e

# Run type checking
npm run type-check

# Run linting
npm run lint
```

### Writing Tests

- Write tests for new features
- Aim for >80% code coverage
- Test edge cases and error conditions
- Use descriptive test names

**Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { calculateAccountBalance } from './accounting';

describe('calculateAccountBalance', () => {
  it('should calculate asset account balance correctly', () => {
    const transactions = [
      { debit: 100, credit: 0 },
      { debit: 50, credit: 30 },
    ];
    
    const balance = calculateAccountBalance('ASSET', transactions);
    
    expect(balance).toBe(120);
  });

  it('should handle empty transactions', () => {
    const balance = calculateAccountBalance('ASSET', []);
    expect(balance).toBe(0);
  });
});
```

## Database Changes

### Creating Migrations

1. **Update schema:**
   ```typescript
   // prisma/schema.prisma
   model NewModel {
     id String @id @default(uuid())
     // ... fields
   }
   ```

2. **Create migration:**
   ```bash
   npx prisma migrate dev --name add_new_model
   ```

3. **Update seed data** if needed:
   ```typescript
   // prisma/seed.ts
   await prisma.newModel.create({ ... });
   ```

### Migration Guidelines

- Keep migrations small and focused
- Test migrations on a copy of production data
- Include rollback strategy
- Document breaking changes

## Documentation

### Code Comments

- Comment complex logic
- Use JSDoc for public functions
- Explain *why*, not *what*

**Good:**
```typescript
/**
 * Calculates account balance using double-entry bookkeeping rules.
 * Asset and expense accounts: debits increase, credits decrease.
 * Liability, equity, and revenue: credits increase, debits decrease.
 */
function calculateBalance(account: Account): number {
  // ...
}
```

### README Updates

- Keep README.md up to date
- Add examples for new features
- Update setup instructions if needed

### API Documentation

- Document all API endpoints
- Include request/response examples
- Note authentication requirements

## Security

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities. Email security@transparency-platform.com instead.

### Security Guidelines

- Never commit secrets or credentials
- Use environment variables
- Validate and sanitize all inputs
- Use parameterized queries (Prisma does this)
- Implement rate limiting on sensitive endpoints
- Keep dependencies updated

## Performance

### Best Practices

- Optimize database queries
- Use pagination for large lists
- Implement caching where appropriate
- Lazy load components
- Optimize images (use Next.js Image)

### Performance Testing

```bash
# Lighthouse CI
npm run lighthouse

# Bundle analysis
npm run analyze
```

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release branch: `release/v1.2.0`
4. Run full test suite
5. Create pull request to `main`
6. After merge, create git tag: `v1.2.0`
7. Deploy to production

## Getting Help

- **Discord**: [Join our community](https://discord.gg/transparency)
- **GitHub Discussions**: Ask questions
- **Email**: dev@transparency-platform.com

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project website

Thank you for contributing to financial transparency! 🎉
