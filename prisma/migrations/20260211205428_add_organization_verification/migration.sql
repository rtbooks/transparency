-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'VERIFICATION_FAILED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "determination_letter_url" TEXT,
ADD COLUMN     "ein_verified_at" TIMESTAMP(3),
ADD COLUMN     "official_website" TEXT,
ADD COLUMN     "verification_notes" TEXT,
ADD COLUMN     "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by" TEXT;
