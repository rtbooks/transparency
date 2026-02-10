import { defineConfig, env } from "prisma/config";
import "./load-env.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // For Neon: use DIRECT_DATABASE_URL (non-pooler) for migrations.
    // Falls back to DATABASE_URL for local dev where pooling isn't used.
    url: process.env.DIRECT_DATABASE_URL || env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
  },
});
