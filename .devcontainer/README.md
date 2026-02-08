# Development Container Setup

This directory contains the configuration for a complete, reproducible development environment using VS Code Dev Containers.

## What's Included

- **Node.js 20** - Latest LTS version
- **PostgreSQL 16** - Database server
- **Prisma** - Database toolkit
- **VS Code Extensions** - Pre-configured for optimal DX
- **Automatic Setup** - Dependencies installed on first run

## Prerequisites

1. **VS Code** with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. **Docker Desktop** installed and running
   - [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
   - [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
   - [Docker for Linux](https://docs.docker.com/engine/install/)

## Getting Started

### Option 1: Using VS Code (Recommended)

1. **Open the project in VS Code**
   ```bash
   code /home/hayep/code/transparency
   ```

2. **Reopen in Container**
   - VS Code will detect the `.devcontainer` configuration
   - Click "Reopen in Container" when prompted
   - OR: Press `F1` → "Dev Containers: Reopen in Container"

3. **Wait for setup to complete** (first time only, ~5-10 minutes)
   - Docker images will be downloaded
   - Dependencies will be installed
   - Database will be initialized

4. **Start developing!**
   ```bash
   npm run dev
   ```

### Option 2: Using VS Code CLI

```bash
# Clone and open in container in one command
code --folder-uri vscode-remote://dev-container+$(echo /home/hayep/code/transparency | xxd -p | tr -d '\n')/workspace/transparency
```

### Option 3: Manual Docker Compose

If you prefer not to use VS Code Dev Containers:

```bash
cd /home/hayep/code/transparency/.devcontainer
docker-compose up -d
docker-compose exec app bash
```

## What Happens Automatically

### On First Container Creation (`post-create.sh`)

1. ✅ Creates Next.js project (if not exists)
2. ✅ Installs all npm dependencies
3. ✅ Initializes Shadcn/ui
4. ✅ Sets up Prisma with database schema
5. ✅ Generates Prisma Client
6. ✅ Creates `.env.local` configuration file
7. ✅ Adds helpful npm scripts

### On Every Container Start (`post-start.sh`)

1. ✅ Waits for PostgreSQL to be ready
2. ✅ Initializes database schema (if empty)
3. ✅ Shows helpful commands

## Ports

The following ports are automatically forwarded:

- **3000** - Next.js development server
- **5432** - PostgreSQL database
- **5555** - Prisma Studio (database GUI)

## Environment Variables

The container automatically sets:

- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV=development`

Additional environment variables (API keys) need to be added manually to `.env.local`:

1. **Clerk** (Authentication) - Get from [clerk.com](https://clerk.com)
2. **Stripe** (Payments) - Get from [stripe.com](https://stripe.com)

## VS Code Extensions

The following extensions are automatically installed:

### Essential
- ESLint - Code linting
- Prettier - Code formatting
- Tailwind CSS IntelliSense - Tailwind autocomplete

### TypeScript & React
- TypeScript Next - Enhanced TypeScript support
- ES7+ React Snippets - React code snippets

### Database
- Prisma - Prisma schema support
- PostgreSQL - Database management

### Git
- GitLens - Enhanced Git integration

### Quality of Life
- Pretty TypeScript Errors - Readable error messages
- Import Cost - Show package sizes
- Path Intellisense - Path autocomplete
- Auto Rename Tag - Sync HTML tag renaming
- Markdown All in One - Markdown editing

## Useful Commands

Once inside the container:

```bash
# Development
npm run dev              # Start Next.js dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:push          # Push schema to database
npm run db:seed          # Seed database with sample data
npm run db:studio        # Open Prisma Studio
npm run db:reset         # Reset database (WARNING: deletes all data)

# Stripe
npm run stripe:listen    # Listen for Stripe webhooks locally

# Prisma Commands
npx prisma generate      # Generate Prisma Client
npx prisma studio        # Open Prisma Studio
npx prisma migrate dev   # Create new migration
npx prisma db pull       # Pull schema from database
npx prisma db push       # Push schema to database
```

## Database Access

### From within the container:

```bash
# Connect to PostgreSQL
psql postgresql://transparency:devpassword@localhost:5432/transparency_dev

# Or use Prisma Studio (GUI)
npm run db:studio
```

### From your host machine:

Use any PostgreSQL client with:
- Host: `localhost`
- Port: `5432`
- User: `transparency`
- Password: `devpassword`
- Database: `transparency_dev`

## Troubleshooting

### Container won't start

1. **Check Docker is running**
   ```bash
   docker ps
   ```

2. **Rebuild container**
   - Press `F1` → "Dev Containers: Rebuild Container"

3. **Check Docker logs**
   ```bash
   docker-compose -f .devcontainer/docker-compose.yml logs
   ```

### Database connection issues

1. **Check PostgreSQL is running**
   ```bash
   docker-compose -f .devcontainer/docker-compose.yml ps
   ```

2. **Check database logs**
   ```bash
   docker-compose -f .devcontainer/docker-compose.yml logs db
   ```

3. **Restart database**
   ```bash
   docker-compose -f .devcontainer/docker-compose.yml restart db
   ```

### Port already in use

If ports 3000, 5432, or 5555 are already in use on your host:

1. Stop the conflicting service, OR
2. Edit `.devcontainer/docker-compose.yml` to use different ports

### Slow initial setup

The first build can take 5-10 minutes depending on:
- Internet connection speed
- Docker image download
- npm package installation

Subsequent starts are much faster (~10-30 seconds).

### Changes not reflecting

1. **Hard reload browser**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
2. **Restart Next.js dev server**: Stop with `Ctrl+C`, then `npm run dev`
3. **Rebuild container**: `F1` → "Dev Containers: Rebuild Container"

## Customization

### Adding VS Code Extensions

Edit `.devcontainer/devcontainer.json`:

```json
{
  "customizations": {
    "vscode": {
      "extensions": [
        "existing.extensions",
        "your.new-extension"
      ]
    }
  }
}
```

Then rebuild the container.

### Changing Node.js Version

Edit `.devcontainer/devcontainer.json`:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "18"  // or "20", "21", etc.
    }
  }
}
```

### Adding System Packages

Edit `.devcontainer/Dockerfile`:

```dockerfile
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    your-package-here \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*
```

## Data Persistence

- **Database data** is persisted in a Docker volume (`postgres-data`)
- **Code changes** are automatically synced between container and host
- **node_modules** are stored in the container for faster performance

To completely reset:

```bash
# Remove all containers and volumes
docker-compose -f .devcontainer/docker-compose.yml down -v

# Rebuild from scratch
# In VS Code: F1 → "Dev Containers: Rebuild Container"
```

## Working with Multiple Collaborators

Each collaborator only needs:

1. Clone the repository
2. Open in VS Code
3. Click "Reopen in Container"

Everything else is automatic! No need to:
- Install Node.js
- Install PostgreSQL
- Configure environment
- Install VS Code extensions
- Set up linting/formatting

The devcontainer ensures everyone has the exact same environment.

## Performance Tips

### For macOS/Windows Users

Docker on Mac/Windows uses a VM, which can be slower. Tips:

1. **Allocate more resources to Docker**
   - Docker Desktop → Settings → Resources
   - Increase CPUs to 4+ and Memory to 8GB+

2. **Use cached volumes** (already configured)
   ```yaml
   volumes:
     - ../..:/workspaces:cached
   ```

3. **node_modules in container** (already configured)
   - Significantly faster builds and installs

### For Linux Users

Docker on Linux runs natively, so performance is excellent by default.

## CI/CD Integration

This devcontainer configuration can be used in:

- **GitHub Codespaces** - Cloud-based development
- **GitLab** - With GitLab Dev Containers
- **CI Pipelines** - Consistent test environment

## Security Notes

- Default database password is `devpassword`
- This is for local development only
- Never use these credentials in production
- Add actual secrets to `.env.local` (git-ignored)

## Getting Help

- **Issues with Dev Containers**: [VS Code Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- **Docker Issues**: [Docker Documentation](https://docs.docker.com/)
- **Project Setup**: See [QUICKSTART.md](../QUICKSTART.md)
- **Contributing**: See [CONTRIBUTING.md](../CONTRIBUTING.md)

## What's Next?

Once your container is running:

1. ✅ Add API keys to `.env.local`
2. ✅ Run `npm run db:push` to create database schema
3. ✅ Run `npm run db:seed` to add sample data
4. ✅ Run `npm run dev` to start developing
5. ✅ Visit http://localhost:3000

Happy coding! 🚀
