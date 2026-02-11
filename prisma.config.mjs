import { config } from "dotenv";
import { resolve } from "path";
import { defineConfig } from "prisma/config";

// Only load .env files in local development
// In Vercel, environment variables are injected directly
if (process.env.NODE_ENV !== "production") {
  config({ path: resolve(process.cwd(), ".env.local") });
  config({ path: resolve(process.cwd(), ".env") });
}

// Vercel's Neon integration provides DATABASE_URL_UNPOOLED for direct (non-pooled) connections
// Fall back to DIRECT_DATABASE_URL for backwards compatibility or manual setup
// Finally fall back to DATABASE_URL for local dev
const databaseUrl = 
  process.env.DATABASE_URL_UNPOOLED || 
  process.env.DIRECT_DATABASE_URL || 
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Missing database connection string. Set DATABASE_URL_UNPOOLED, DIRECT_DATABASE_URL, or DATABASE_URL environment variable."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // For Neon: use DATABASE_URL_UNPOOLED (Vercel integration) or DIRECT_DATABASE_URL (manual setup)
    // These are non-pooled connections required for migrations.
    // Falls back to DATABASE_URL for local dev where pooling isn't used.
    url: databaseUrl,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
