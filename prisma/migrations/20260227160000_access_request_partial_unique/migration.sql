-- Drop the blanket unique constraint on (organization_id, user_id)
-- This allows multiple resolved access requests for audit history
ALTER TABLE "access_requests" DROP CONSTRAINT IF EXISTS "access_requests_organization_id_user_id_key";

-- Add a non-unique index for lookups by org + user
CREATE INDEX IF NOT EXISTS "idx_access_request_org_user" ON "access_requests"("organization_id", "user_id");

-- Add a partial unique index: only one PENDING request per user per org
CREATE UNIQUE INDEX "access_requests_org_user_pending_unique"
  ON "access_requests"("organization_id", "user_id")
  WHERE "status" = 'PENDING';
