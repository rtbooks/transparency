# GitHub Copilot CLI Instructions

## Critical Repository Rules

### 🔒 Branch Protection - ALWAYS FOLLOW THIS

**The `main` branch is PROTECTED. Direct commits are NOT allowed.**

**REQUIRED WORKFLOW:**
1. ✅ **Always create a feature branch** before making any changes
2. ✅ **Make all changes on the feature branch**
3. ✅ **Commit changes to the feature branch**
4. ✅ **Push the feature branch to origin**
5. ✅ **Create a Pull Request** targeting `main`
6. ⏳ Wait for review and approval
7. ✅ Maintainer merges PR after approval

**Branch Naming Convention:**
```bash
feature/<description>  # New features
fix/<description>      # Bug fixes
docs/<description>     # Documentation updates
refactor/<description> # Code refactoring
test/<description>     # Test changes
chore/<description>    # Maintenance tasks
```

**Example Workflow:**
```bash
# Start new work
git checkout main
git pull origin main
git checkout -b feature/add-export-feature

# Make changes and commit
git add -A
git commit -m "feat: add transaction export to CSV"

# Push branch
git push origin feature/add-export-feature

# Create PR via GitHub CLI or web interface
gh pr create --base main --title "feat: add transaction export to CSV"
```

### ❌ NEVER Do This
```bash
# DON'T commit directly to main
git checkout main
git commit -m "some change"
git push origin main  # ❌ This will be REJECTED
```

## Project-Specific Workflow

### Database Changes

When making schema changes:
1. Create feature branch
2. Update `prisma/schema.prisma`
3. Run `npx prisma migrate dev --name descriptive_name`
4. Test migrations locally
5. Commit migration files along with schema changes
6. Push branch and create PR

### Code Changes

1. Create feature branch
2. Make changes following coding standards (see CONTRIBUTING.md)
3. Run tests: `npm test`
4. Run type check: `npm run type-check`
5. Run linting: `npm run lint`
6. Commit with conventional commit format
7. Push and create PR

### Documentation Changes

1. Create `docs/<description>` branch
2. Update relevant documentation
3. Verify links and formatting
4. Commit and push
5. Create PR (no tests required for docs-only changes)

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

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
feat(transactions): add bulk CSV import functionality

Allows users to import multiple transactions from CSV files.
Validates against chart of accounts and provides error feedback.

Closes #123
```

```
fix(migrations): handle existing ENUMs in deploy script

Updates migration deployment script to detect and skip
existing database objects when rerunning failed migrations.

Fixes #456
```

## Testing Requirements

Before creating PR:
- [ ] All tests pass: `npm test`
- [ ] Type checking passes: `npm run type-check`
- [ ] No linting errors: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Manual testing performed (if applicable)

## Security Reminders

- ❌ Never commit secrets or API keys
- ✅ Use environment variables in `.env.local`
- ✅ Validate all user inputs with Zod
- ✅ Use Prisma's parameterized queries (avoid raw SQL)
- ✅ Implement rate limiting on sensitive endpoints

## Deployment

Deployments happen automatically when PRs are merged to `main`:
1. PR merged → triggers Vercel deployment
2. Migrations run automatically
3. Next.js app builds
4. Deployment goes live

**No manual deployment needed!**

## Getting Help

- Review `CONTRIBUTING.md` for detailed guidelines
- Check `DEPLOYMENT_SETUP.md` for deployment info
- Review `APPROACH.md` for architecture decisions
- Ask in PR comments or discussions

## Quick Reference

**Start new work:**
```bash
git checkout main && git pull && git checkout -b feature/my-feature
```

**Push and create PR:**
```bash
git push origin feature/my-feature
gh pr create --base main
```

**Update your branch with main:**
```bash
git checkout main && git pull
git checkout feature/my-feature
git rebase main  # or: git merge main
```

---

**Remember: ALWAYS work on a feature branch. NEVER push directly to `main`.**
