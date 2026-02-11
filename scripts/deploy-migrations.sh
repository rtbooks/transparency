#!/bin/bash
set -e  # Exit on any error

echo "=================================="
echo "Database Migration Deployment"
echo "=================================="
echo ""

# Check for required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "✓ Environment variables found"
echo "  DATABASE_URL: ${DATABASE_URL:0:30}..."
if [ ! -z "$DATABASE_URL_UNPOOLED" ]; then
  echo "  DATABASE_URL_UNPOOLED: ${DATABASE_URL_UNPOOLED:0:30}..."
fi
if [ ! -z "$DIRECT_DATABASE_URL" ]; then
  echo "  DIRECT_DATABASE_URL: ${DIRECT_DATABASE_URL:0:30}..."
fi
echo ""

# Determine which database URL to use for migrations
# Priority: DATABASE_URL_UNPOOLED > DIRECT_DATABASE_URL > DATABASE_URL
MIGRATION_URL="${DATABASE_URL_UNPOOLED:-${DIRECT_DATABASE_URL:-$DATABASE_URL}}"

if [ "$MIGRATION_URL" != "$DATABASE_URL" ]; then
  echo "ℹ️  Using direct/unpooled connection for migrations"
else
  echo "⚠️  WARNING: Using pooled connection for migrations (not recommended)"
  echo "   Add DATABASE_URL_UNPOOLED to Vercel environment variables"
fi
echo ""

echo "Running: npx prisma migrate deploy"
echo "----------------------------------"

# Run migrations with proper error handling
if ! npx prisma migrate deploy; then
  echo ""
  echo "❌ Migration failed!"
  echo ""
  echo "Common issues:"
  echo "  1. Database connection timeout"
  echo "  2. Missing DATABASE_URL_UNPOOLED variable"
  echo "  3. Migration conflicts"
  echo ""
  echo "Debug info:"
  npx prisma -v
  echo ""
  exit 1
fi

echo ""
echo "✅ Migrations completed successfully!"
echo ""
echo "Applied migrations:"
npx prisma migrate status || true
echo ""
