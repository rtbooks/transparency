#!/bin/bash

# Post-start script - runs every time the container starts
set -e

echo "🔄 Container started..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p 5432 -U transparency > /dev/null 2>&1; do
    sleep 1
done
echo "✅ PostgreSQL is ready!"

# Change to project directory
cd /workspace

# Check if Prisma schema exists and database needs initialization
if [ -f "prisma/schema.prisma" ]; then
    # Check if database is empty
    DB_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM pg_tables WHERE schemaname = 'public' LIMIT 1;" 2>/dev/null || echo "")
    
    if [ -z "$DB_EXISTS" ]; then
        echo "📊 Database is empty. Initializing schema..."
        npx prisma db push --accept-data-loss 2>/dev/null || true
    fi
fi

echo "✨ Ready to code!"
echo ""
echo "🚀 Quick commands:"
echo "   npm run dev          - Start Next.js development server"
echo "   npm run db:studio    - Open Prisma Studio (database GUI)"
echo "   npm run db:push      - Push schema changes to database"
echo "   npm run db:seed      - Seed database with sample data"
echo ""
