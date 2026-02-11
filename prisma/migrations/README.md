# Database Migrations

This directory contains the migration history for the Financial Transparency Platform database.

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
