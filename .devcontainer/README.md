# Development container

The devcontainer provides the repository's local development environment: Node.js 20,
PostgreSQL 16, and the VS Code extensions listed in `devcontainer.json`.

## Prerequisites

- Docker Desktop (or Docker Engine on Linux)
- VS Code with the Dev Containers extension

## Start with VS Code

1. Clone the repository and open its root directory in VS Code.
2. Choose **Reopen in Container** (or run **Dev Containers: Reopen in Container** from
   the command palette).
3. On first creation, the configured post-create script installs dependencies,
   generates Prisma Client, and pushes the schema to the local development database.
4. Start the app:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). The container does not create
`.env.local` or configure third-party credentials. Copy `.env.example` to `.env.local`
and add development credentials only for integrations you want to test.

## Start with Docker Compose (without VS Code)

From the repository root:

```bash
docker compose -f .devcontainer/docker-compose.yml up -d
docker compose -f .devcontainer/docker-compose.yml exec app bash
bash .devcontainer/post-create.sh
```

Then run `npm run dev` inside the app container. The compose setup is intended for local
development; do not expose its default database credentials to a network or use them in
production.

## What the container scripts do

- `.devcontainer/post-create.sh` runs `npm install`, `prisma generate`, and
  `prisma db push --accept-data-loss` when the schema file exists.
- `.devcontainer/post-start.sh` waits for PostgreSQL and attempts to push the schema if
  it sees no tables in the local database.
- The database uses the persistent Docker volume `postgres-data`.

The schema push is intended only for the disposable/local development database. Check
`DATABASE_URL` before running database commands. `npm run db:reset` and `docker compose
down -v` delete data; the latter also removes the persisted database volume.

There is no general-purpose application sample-data seed script. The E2E seed command
is for a dedicated test database only; see the
[development guide](../docs/development/README.md) and [setup guide](../DEV_SETUP.md).

## Ports and database access

| Port | Service |
|---|---|
| 3000 | Next.js development server |
| 5432 | PostgreSQL |
| 5555 | Prisma Studio, when started |

The local database defaults are configured in `.devcontainer/docker-compose.yml` and
`devcontainer.json`: host `localhost`, port `5432`, user `transparency`, database
`transparency_dev`, password `devpassword`. They are for local development only.

Useful commands from the repository root:

```bash
npm run db:studio        # Open Prisma Studio
npm run db:push          # Push schema to the configured database
npm run stripe:listen    # Forward Stripe webhooks (requires Stripe CLI and credentials)
```

## Troubleshooting

- **Container won't start:** Check that Docker is running; then use **Dev Containers:
  Rebuild Container** in VS Code.
- **Database connection fails:** Check `docker compose -f .devcontainer/docker-compose.yml
  ps` and inspect the `db` service logs.
- **Port conflict:** Stop the host service using port 3000, 5432, or 5555, or change the
  port mappings in `.devcontainer/docker-compose.yml` and the forwarded ports in
  `devcontainer.json` consistently.
- **Changes aren't visible:** Restart `npm run dev` and hard-refresh the browser before
  rebuilding the container.

See [DEV_SETUP.md](../DEV_SETUP.md) for manual setup and
[CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidance.
