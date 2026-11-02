-- Split certificate validity from certificate verification.
-- Existing rows stay unverified. A previous "verified" label is not copied forward.

CREATE TYPE "CertificateStatus" AS ENUM ('VALID', 'EXPIRING_SOON', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'UNKNOWN');

CREATE TYPE "CertificateVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "Certification" ADD COLUMN "certificateNumber" TEXT;
ALTER TABLE "Certification" ADD COLUMN "certificateStatus" "CertificateStatus" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Certification" ADD COLUMN "verificationStatus" "CertificateVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "Certification" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Certification" ADD COLUMN "verifiedBy" TEXT;
ALTER TABLE "Certification" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Certification" AS cert
SET "isDemo" = true
FROM "Supplier" AS supplier
WHERE supplier."id" = cert."supplierId"
  AND supplier."dataType" = 'DEMO';

UPDATE "Certification"
SET "certificateStatus" = 'EXPIRED'
WHERE "status" = 'EXPIRED';

DROP INDEX "Certification_supplierId_status_idx";

ALTER TABLE "Certification" DROP COLUMN "status";

DROP TYPE "CertificationStatus";

CREATE INDEX "Certification_supplierId_certificateStatus_idx" ON "Certification"("supplierId", "certificateStatus");
CREATE INDEX "Certification_supplierId_verificationStatus_idx" ON "Certification"("supplierId", "verificationStatus");
CREATE INDEX "Certification_expiresAt_idx" ON "Certification"("expiresAt");
CREATE INDEX "Certification_isDemo_idx" ON "Certification"("isDemo");
