# Database Migrations

This directory contains the migration history for the RadBooks database.

## Creating migrations

Commit each schema change with a new migration. Migration files:

- Has a timestamp prefix (e.g., `20260211123456_add_feature`)
- Contains the SQL needed to apply the change
- Are applied to production only when the deployment is configured to run `prisma migrate deploy`

Prisma Migrate does not automatically reverse an applied migration. To undo a schema
change, normally create and deploy a new forward migration. `prisma migrate resolve`
only changes migration bookkeeping; it does not reverse SQL or restore data.

## Creating New Migrations

```bash
# Make changes to prisma/schema.prisma, then:
npx prisma migrate dev --name descriptive_migration_name
```

## Applying migrations in production

This repository's `vercel-build` script applies migrations before building:

```
prisma migrate deploy && prisma generate && next build
```

Confirm the Vercel project uses `npm run vercel-build` (or an equivalent deployment
command) and has a direct, non-pooled migration URL configured. Other deployment
platforms must run `prisma migrate deploy` as part of their release process.
