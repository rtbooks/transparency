-- Add public_transparency column to organizations table
ALTER TABLE "organizations" ADD COLUMN "public_transparency" BOOLEAN NOT NULL DEFAULT false;
