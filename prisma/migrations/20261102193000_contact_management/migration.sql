-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EMAIL_SENT', 'PHONE_CALL', 'MESSAGE_SENT', 'SUPPLIER_REPLIED', 'PRICE_RECEIVED', 'MEETING', 'STATUS_CHANGED', 'NOTE_ADDED', 'FOLLOW_UP_SCHEDULED');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'PHONE', 'MESSAGE', 'MEETING', 'OTHER');

-- CreateTable
CREATE TABLE "SupplierContactPerson" (
    "id" UUID NOT NULL,
    "workspaceKey" TEXT NOT NULL DEFAULT 'demo-workspace',
    "supplierId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "phoneKey" TEXT,
    "preferredChannel" "CommunicationChannel",
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierContactPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactActivity" (
    "id" UUID NOT NULL,
    "workspaceKey" TEXT NOT NULL DEFAULT 'demo-workspace',
    "supplierId" UUID NOT NULL,
    "contactPersonId" UUID,
    "type" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "channel" "CommunicationChannel",
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "previousStatus" "ContactStatus",
    "newStatus" "ContactStatus",
    "followUpOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierContactPerson_workspaceKey_supplierId_idx" ON "SupplierContactPerson"("workspaceKey", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierContactPerson_supplierId_idx" ON "SupplierContactPerson"("supplierId");

-- One primary contact person per supplier in a workspace.
CREATE UNIQUE INDEX "SupplierContactPerson_one_primary_idx" ON "SupplierContactPerson"("workspaceKey", "supplierId") WHERE "isPrimary";

-- Duplicate email or phone is rejected. Empty values stay allowed.
CREATE UNIQUE INDEX "SupplierContactPerson_email_idx" ON "SupplierContactPerson"("workspaceKey", "supplierId", "email") WHERE "email" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SupplierContactPerson_phone_idx" ON "SupplierContactPerson"("workspaceKey", "supplierId", "phoneKey") WHERE "phoneKey" IS NOT NULL;

-- CreateIndex
CREATE INDEX "ContactActivity_workspaceKey_supplierId_occurredAt_idx" ON "ContactActivity"("workspaceKey", "supplierId", "occurredAt");

-- CreateIndex
CREATE INDEX "ContactActivity_workspaceKey_supplierId_type_idx" ON "ContactActivity"("workspaceKey", "supplierId", "type");

-- CreateIndex
CREATE INDEX "ContactActivity_contactPersonId_idx" ON "ContactActivity"("contactPersonId");

-- AddForeignKey
ALTER TABLE "SupplierContactPerson" ADD CONSTRAINT "SupplierContactPerson_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "SupplierContactPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
