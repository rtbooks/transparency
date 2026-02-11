#!/bin/bash
set +e  # Don't exit on error initially

echo "Running database migrations..."

# Try to run migrations and capture output
output=$(npx prisma migrate deploy 2>&1)
exit_code=$?

echo "$output"

# Check if the error is about non-empty database (P3005) or failed migrations (P3009)
if [ $exit_code -ne 0 ]; then
  if echo "$output" | grep -q "P3005"; then
    echo ""
    echo "Database is not empty. Marking baseline migration as applied..."
    npx prisma migrate resolve --applied 20260211000000_initial
    
    echo ""
    echo "Re-running migrations..."
    npx prisma migrate deploy
    
    exit_code=$?
  elif echo "$output" | grep -q "P3009"; then
    echo ""
    echo "Found failed migrations. Rolling back failed migration..."
    npx prisma migrate resolve --rolled-back 0_init || true
    
    echo ""
    echo "Marking baseline migration as applied..."
    npx prisma migrate resolve --applied 20260211000000_initial
    
    echo ""
    echo "Re-running migrations..."
    npx prisma migrate deploy
    
    exit_code=$?
  fi
fi

if [ $exit_code -ne 0 ]; then
  echo "Migration failed!"
  exit 1
fi

echo "Migrations completed successfully!"
