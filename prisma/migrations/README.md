# Database Migrations

This directory contains the migration history for the Financial Transparency Platform database.

## Initial Migration (20260211000000_initial)

The initial migration is a **baseline migration** that represents the schema that was already deployed to production via `prisma db push`.

Since the database schema already exists, this migration file is intentionally empty. It serves as a reference point for future migrations.

### Why is it empty?

The database was initially created using `prisma db push` during development. To transition to proper migration tracking (required for production), we created this baseline migration and marked it as applied in the production database.

## Future Migrations

All future schema changes will be tracked as new migration files in this directory. Each migration:
- Has a timestamp prefix (e.g., `20260211123456_add_feature`)
- Contains the SQL needed to apply the change
- Is automatically applied during Vercel deployment
- Can be rolled back if needed

## Creating New Migrations

```bash
# Make changes to prisma/schema.prisma, then:
npx prisma migrate dev --name descriptive_migration_name
```

## Applying Migrations in Production

Migrations are automatically applied during Vercel deployment via the `vercel-build` script:
```
prisma migrate deploy && prisma generate && next build
```

No manual intervention needed! 🎉
