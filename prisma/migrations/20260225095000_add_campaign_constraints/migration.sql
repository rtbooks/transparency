-- CreateEnum: CampaignType
CREATE TYPE "CampaignType" AS ENUM ('OPEN', 'FIXED_UNIT', 'TIERED');

-- Add campaign constraint fields to campaigns table
ALTER TABLE "campaigns" ADD COLUMN "campaign_type" "CampaignType" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "campaigns" ADD COLUMN "unit_price" DECIMAL(12, 2);
ALTER TABLE "campaigns" ADD COLUMN "max_units" INTEGER;
ALTER TABLE "campaigns" ADD COLUMN "unit_label" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "allow_multi_unit" BOOLEAN NOT NULL DEFAULT true;

-- Add unit tracking fields to donations table
ALTER TABLE "donations" ADD COLUMN "unit_count" INTEGER;
ALTER TABLE "donations" ADD COLUMN "tier_id" TEXT;

-- Create CampaignTier table
CREATE TABLE "campaign_tiers" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    "max_slots" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "campaign_tiers_pkey" PRIMARY KEY ("id")
);

-- Indexes and foreign keys
CREATE INDEX "idx_tier_campaign" ON "campaign_tiers"("campaign_id");
ALTER TABLE "campaign_tiers" ADD CONSTRAINT "campaign_tiers_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "campaign_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
