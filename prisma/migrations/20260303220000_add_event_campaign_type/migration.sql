-- AlterEnum
ALTER TYPE "CampaignType" ADD VALUE 'EVENT';

-- CreateTable
CREATE TABLE "campaign_items" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "max_quantity" INTEGER,
    "min_per_order" INTEGER NOT NULL DEFAULT 0,
    "max_per_order" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "campaign_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_line_items" (
    "id" TEXT NOT NULL,
    "donation_id" TEXT NOT NULL,
    "campaign_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "donation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_campaign_item_campaign" ON "campaign_items"("campaign_id");

-- CreateIndex
CREATE INDEX "idx_line_item_donation" ON "donation_line_items"("donation_id");

-- CreateIndex
CREATE INDEX "idx_line_item_campaign_item" ON "donation_line_items"("campaign_item_id");

-- AddForeignKey
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_line_items" ADD CONSTRAINT "donation_line_items_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_line_items" ADD CONSTRAINT "donation_line_items_campaign_item_id_fkey" FOREIGN KEY ("campaign_item_id") REFERENCES "campaign_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
