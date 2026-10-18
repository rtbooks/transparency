# Contributing to RadBooks

Thanks for your interest in contributing. Please use the repository's current code and
configuration as the source of truth; older examples and plans may no longer apply.

## Code of conduct

Be welcoming, respectful, and constructive. Harassment and discriminatory behavior are
not acceptable.

## Report bugs and suggest features

Search [existing issues](https://github.com/rtbooks/transparency/issues) first. Include
reproduction steps, expected and actual behavior, and relevant environment details for
bug reports. For feature requests, describe the problem, proposed solution, and intended
users.

Do not report security vulnerabilities in public issues. Contact
security@radbooks.org instead.

## Pull requests

The `main` branch is protected; submit changes through a pull request.

1. Create a focused branch from `main`, for example `feature/bulk-import`,
   `fix/payment-description`, or `docs/setup-guide`.
2. Make a focused change and add or update tests where appropriate.
3. Update documentation affected by the change.
4. Run the relevant checks:

   ```bash
   npm test
   npm run type-check
   npm run lint
   ```

   For browser tests, install Playwright Chromium if needed with
   `npx playwright install chromium`, then run `npm run test:e2e`.

5. Use a clear commit message. Conventional Commit prefixes such as `feat:`, `fix:`,
   `docs:`, `test:`, and `chore:` are encouraged.
6. Push the branch and open a pull request targeting `main`. Explain the change, link
   related issues, and include screenshots for user-interface changes.

## Project-specific conventions

- Use TypeScript and follow the patterns in nearby code.
- Validate API input and return appropriate errors; follow the authorization pattern
  used by comparable routes.
- Import `PrismaClient` and generated Prisma types from
  `@/generated/prisma/client`; use the shared client from `@/lib/prisma`.
- Keep secrets out of source control and use environment variables.
- For architectural decisions, consult `docs/adr/`. For development setup, see
  [DEV_SETUP.md](./DEV_SETUP.md).
- For code layout, authorization, financial invariants, and test selection, see the
  [development guide](./docs/development/README.md).

## Database changes

Update `prisma/schema.prisma`, create a migration with
`npx prisma migrate dev --name descriptive_name`, and test the change locally. Do not
rewrite migrations that have already been applied; add a follow-up migration instead.

Thank you for helping improve RadBooks.
