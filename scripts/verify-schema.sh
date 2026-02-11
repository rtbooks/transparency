#!/bin/bash
set -e

echo "=================================="
echo "Verifying Database Schema"
echo "=================================="
echo ""

# Check if we can connect to the database
if ! npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
  echo "❌ Cannot connect to database"
  exit 1
fi

echo "✓ Database connection successful"
echo ""

# Check migration status
echo "Checking migration status..."
if ! npx prisma migrate status; then
  echo ""
  echo "❌ Database schema is out of sync with migrations!"
  echo ""
  echo "This usually means:"
  echo "  1. Migrations didn't run during deployment"
  echo "  2. DATABASE_URL_UNPOOLED is missing"
  echo "  3. Manual schema changes were made"
  echo ""
  exit 1
fi

echo ""
echo "✅ Database schema is up to date!"
echo ""
