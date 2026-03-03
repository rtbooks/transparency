-- Add cleared/clearedAt fields to transactions (bank import clearing vs formal reconciliation)
ALTER TABLE "transactions" ADD COLUMN "cleared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transactions" ADD COLUMN "cleared_at" TIMESTAMP(3);
