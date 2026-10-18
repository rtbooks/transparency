# Preview deployments and database isolation

This guide describes how to configure and verify preview deployments for a RadBooks
instance using Vercel and, optionally, Neon database branching. Provider integrations and
account settings control the actual behavior; this repository does not contain a
configuration that guarantees a database branch for every preview.

## Before enabling previews

- Decide which branches and pull requests may create previews.
- Choose a non-production data source for previews. Do not assume a Neon branch is
  empty, sanitized, or isolated from production until you have confirmed its parent and
  data in the Neon dashboard.
- Configure preview-specific Clerk and Stripe credentials. Vercel environment-variable
  assignments depend on project settings; do not assume preview deployments use safe
  credentials by default.
- Review who can access preview deployments and database branches.
- Check current Vercel and Neon plan limits, retention, and pricing in their dashboards
  and official documentation; these can change.

## Configure and verify

1. In Vercel, connect the repository and confirm which branches create preview
   deployments and which environment variables are assigned to the Preview environment.
2. If using the Neon Vercel integration, install it for the intended Vercel project and
   Neon project. Review its branch, environment-variable, and cleanup settings; the
   available behavior may depend on integration version and account configuration.
3. Create or update a test branch and deploy it. In the Vercel deployment details,
   confirm the selected environment and database URL source. Do not expose connection
   strings in logs, screenshots, or issues.
4. In Neon, verify the actual database branch, its parent, data state, and lifecycle.
   Confirm it is not the production branch before running migrations or test data setup.
5. Verify the deployment build runs migrations against the intended preview database.
   This repository's `vercel-build` script runs `prisma migrate deploy`; confirm the
   Vercel Build Command is configured to use it.
6. Exercise the preview with test accounts and payment credentials, then confirm the
   activity did not affect production services or data.
7. Close the test pull request/branch and verify how its preview deployment and database
   branch are handled. Delete stale resources manually if your configured integration
   does not do so.

## Troubleshooting

### Preview cannot connect to the database

- Check the deployment logs for the database configuration error without copying any
  secret values into a public issue.
- Verify the preview environment has the intended database variables and that the
  database branch exists and is available.
- Confirm the application URL uses the runtime connection and migrations use the
  configured direct connection (see `prisma.config.mjs`).

### A migration fails in preview

- Inspect the migration and the preview database state before retrying.
- Confirm the preview is using the intended database branch; never reset a branch until
  its contents and parent have been verified.
- Fix the migration on the feature branch and redeploy. Do not edit a migration that has
  already been applied to a shared database; add a corrective migration instead.

### Preview appears to contain unexpected data

- Stop testing with it until you identify the branch and parent database.
- Check the integration's configured parent and the branch creation timestamp in Neon.
- Treat any copied production data as sensitive. Apply your organization's data-handling
  and access policies; do not rely on preview access protection as data sanitization.

## References

- [Vercel Preview Deployments](https://vercel.com/docs/deployments/preview-deployments)
- [Neon branching](https://neon.tech/docs/guides/branching)
- [Neon Vercel integration](https://vercel.com/integrations/neon)
- [Vercel pricing](https://vercel.com/pricing)
- [Neon pricing](https://neon.tech/pricing)
