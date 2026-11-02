-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'PHONE', 'WEBSITE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactStatus_new" AS ENUM ('NOT_CONTACTED', 'CONTACTED', 'AWAITING_RESPONSE', 'RESPONDED', 'NEGOTIATING', 'QUALIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Shortlist" ALTER COLUMN "contactStatus" DROP DEFAULT;

ALTER TABLE "Shortlist" ALTER COLUMN "contactStatus" TYPE "ContactStatus_new" USING (
  CASE "contactStatus"::text
    WHEN 'TO_CONTACT' THEN 'NOT_CONTACTED'
    WHEN 'REPLIED' THEN 'RESPONDED'
    ELSE "contactStatus"::text
  END
)::"ContactStatus_new";

DROP TYPE "ContactStatus";

ALTER TYPE "ContactStatus_new" RENAME TO "ContactStatus";

ALTER TABLE "Shortlist" ALTER COLUMN "contactStatus" SET DEFAULT 'NOT_CONTACTED';

ALTER TABLE "Shortlist"
  ADD COLUMN "lastContactOn" DATE,
  ADD COLUMN "nextFollowUpOn" DATE,
  ADD COLUMN "contactPerson" TEXT,
  ADD COLUMN "contactMethod" "ContactMethod";
