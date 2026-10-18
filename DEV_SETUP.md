# Development Environment Setup Guide

Quick reference for getting the development environment running.

## 🚀 Quick Start (Devcontainer - Recommended)

**Prerequisites**: Docker Desktop + VS Code with Dev Containers extension

1. **Open in VS Code**
   ```bash
   code /path/to/transparency
   ```

2. **Reopen in Container**
   - VS Code will prompt: "Reopen in Container"
   - Click the button and wait (~5-10 minutes first time)

3. **Start developing**
   ```bash
   npm run dev
   ```

The container installs dependencies and initializes the local database automatically.
External-service credentials are separate; add development keys to `.env.local` only
for the integrations you want to test.

## 📋 What You Get

- ✅ Node.js 20
- ✅ PostgreSQL 16 (running and configured)
- ✅ Next.js project initialized
- ✅ All dependencies installed
- ✅ Prisma configured
- ✅ Database schema synced
- ✅ VS Code extensions installed
- ✅ Linting & formatting configured

## 🔧 Manual Setup (Alternative)

If you prefer not to use devcontainers:

### 1. Install Prerequisites

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 16 (the devcontainer version; newer supported versions may also work)
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database

```bash
sudo -u postgres psql -c "CREATE USER transparency WITH PASSWORD 'your_password';"
sudo -u postgres createdb --owner=transparency transparency_dev
```

### 3. Install Dependencies

```bash
cd /path/to/transparency
npm install
```

### 4. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local; at minimum, set DATABASE_URL for your local database
nano .env.local
```

### 5. Initialize Database

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database
npx prisma db push
```

There is currently no general-purpose Prisma seed script. The E2E seed script is for
test databases only; do not use it as application sample data or against production.

### 6. Start Development

```bash
npm run dev
```

## 🔑 Required API Keys

You'll need accounts and API keys from:

### 1. Clerk (Authentication)
- Sign up: https://clerk.com
- Create application
- Copy keys to `.env.local`:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`

### 2. Vercel Blob (File Storage)
- Create a Blob store and connect it to the Vercel project to provide
  `BLOB_READ_WRITE_TOKEN` in that deployment environment.
- For local development, configure a development store/token in `.env.local` if testing
  attachment uploads.

### 3. Resend (Email) - Optional for local dev
- Sign up: https://resend.com
- Copy key to `.env.local`:
  - `RESEND_API_KEY`

## 📍 Port Reference

| Port | Service | URL |
|------|---------|-----|
| 3000 | Next.js | http://localhost:3000 |
| 5432 | PostgreSQL | postgresql://localhost:5432 |
| 5555 | Prisma Studio | http://localhost:5555 |

## 🛠️ Daily Workflow

```bash
# Start development server
npm run dev

# Open database GUI in another terminal
npm run db:studio

# Optional: Listen for Stripe webhooks (requires Stripe CLI)
npm run stripe:listen
```

## 📦 Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Lint code

# Database
npm run db:push          # Push schema changes
npm run db:studio        # Open Prisma Studio
npm run db:reset         # Reset database (⚠️ deletes data)

# Prisma
npx prisma generate      # Generate Prisma Client
npx prisma migrate dev   # Create migration
npx prisma studio        # Open database GUI
```

## 🐛 Troubleshooting

### Devcontainer Issues

**Container won't start:**
```bash
# Rebuild container
# In VS Code: Cmd+Shift+P → "Dev Containers: Rebuild Container"
```

**Database connection failed:**
```bash
# Check PostgreSQL is running
docker-compose -f .devcontainer/docker-compose.yml ps

# Restart database
docker-compose -f .devcontainer/docker-compose.yml restart db
```

### Manual Setup Issues

**PostgreSQL connection refused:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql
```

**Prisma Client out of sync:**
```bash
# Regenerate Prisma Client
npx prisma generate
```

**Port 3000 already in use:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process (replace PID)
kill -9 <PID>

# Or run on different port
PORT=3001 npm run dev
```

**npm install fails:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 🔄 Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all packages
npm update

# Update to latest (use with caution)
npx npm-check-updates -u
npm install
```

## 🧹 Cleanup

**Reset everything (devcontainer):**
```bash
# Remove containers and volumes
docker-compose -f .devcontainer/docker-compose.yml down -v

# Rebuild in VS Code
# Cmd+Shift+P → "Dev Containers: Rebuild Container"
```

**Reset database only:**
```bash
npm run db:reset
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Shadcn/ui](https://ui.shadcn.com)

## 🆘 Need Help?

- Check [.devcontainer/README.md](.devcontainer/README.md) for detailed devcontainer info
- See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines
- See [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md) for production deployment

---

**Tip**: Using the devcontainer is highly recommended for the smoothest experience! 🎯
