#!/bin/bash

# Post-create script - runs once after container is created
set -e

echo "🚀 Setting up Financial Transparency Platform development environment..."

# Change to workspace directory (it's mounted at /workspace)
cd /workspace

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "⚠️  No package.json found!"
    echo "This devcontainer expects the Next.js project to already exist."
    echo "Please initialize the project first following QUICKSTART.md"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "📊 Setting up Prisma..."

# Generate Prisma Client if schema exists
if [ -f "prisma/schema.prisma" ]; then
    echo "🔄 Generating Prisma Client..."
    npx prisma generate
    
    echo "🗄️  Pushing schema to database..."
    npx prisma db push --accept-data-loss
else
    echo "⚠️  No prisma/schema.prisma found. Skipping Prisma setup."
fi

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📌 Next steps:"
echo "   1. Run 'npm run dev' to start the development server"
echo "   2. Run 'npx prisma studio' to view the database"
echo ""

