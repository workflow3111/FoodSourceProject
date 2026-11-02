-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'FARM', 'IMPORTER', 'PACKAGING', 'WHOLESALER', 'OTHER');

-- CreateEnum
CREATE TYPE "DataType" AS ENUM ('REAL', 'DEMO');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'PARTIALLY_VERIFIED', 'UNVERIFIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('OFFICIAL_WEBSITE', 'OFFICIAL_CATALOG', 'PUBLIC_REGISTRY', 'MANUAL', 'DEMO');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('PHONE', 'EMAIL', 'WEBSITE_FORM', 'WEBSITE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NOT_CONTACTED', 'TO_CONTACT', 'CONTACTED', 'REPLIED', 'QUALIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('VERIFIED', 'UNVERIFIED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "supplierType" "SupplierType" NOT NULL DEFAULT 'OTHER',
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Россия',
    "address" TEXT,
    "website" TEXT,
    "sourceUrl" TEXT,
    "dataType" "DataType" NOT NULL DEFAULT 'DEMO',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "estimatedPrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "minimumOrderQuantity" DECIMAL(12,3),
    "unit" TEXT,
    "packageDescription" TEXT,
    "priceUpdatedAt" TIMESTAMP(3),
    "deliveryNotes" TEXT,
    "isAvailable" BOOLEAN,
    "dataType" "DataType" NOT NULL DEFAULT 'DEMO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierContact" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "type" "ContactType" NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "documentUrl" TEXT,
    "issuer" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" "CertificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationNotes" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSource" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "evidence" TEXT,
    "checkedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shortlist" (
    "id" UUID NOT NULL,
    "workspaceKey" TEXT NOT NULL DEFAULT 'demo-workspace',
    "supplierId" UUID NOT NULL,
    "contactStatus" "ContactStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shortlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierNote" (
    "id" UUID NOT NULL,
    "workspaceKey" TEXT NOT NULL DEFAULT 'demo-workspace',
    "supplierId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_slug_key" ON "Supplier"("slug");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_city_region_idx" ON "Supplier"("city", "region");

-- CreateIndex
CREATE INDEX "Supplier_dataType_verificationStatus_idx" ON "Supplier"("dataType", "verificationStatus");

-- CreateIndex
CREATE INDEX "Supplier_supplierType_idx" ON "Supplier"("supplierType");

-- CreateIndex
CREATE UNIQUE INDEX "Category_nameRu_key" ON "Category"("nameRu");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");

-- CreateIndex
CREATE INDEX "SupplierProduct_supplierId_idx" ON "SupplierProduct"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierProduct_categoryId_idx" ON "SupplierProduct"("categoryId");

-- CreateIndex
CREATE INDEX "SupplierProduct_name_idx" ON "SupplierProduct"("name");

-- CreateIndex
CREATE INDEX "SupplierProduct_estimatedPrice_idx" ON "SupplierProduct"("estimatedPrice");

-- CreateIndex
CREATE INDEX "SupplierProduct_dataType_idx" ON "SupplierProduct"("dataType");

-- CreateIndex
CREATE INDEX "SupplierContact_supplierId_type_idx" ON "SupplierContact"("supplierId", "type");

-- CreateIndex
CREATE INDEX "Certification_supplierId_status_idx" ON "Certification"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierSource_supplierId_sourceType_idx" ON "SupplierSource"("supplierId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSource_supplierId_url_key" ON "SupplierSource"("supplierId", "url");

-- CreateIndex
CREATE INDEX "Shortlist_workspaceKey_contactStatus_idx" ON "Shortlist"("workspaceKey", "contactStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Shortlist_workspaceKey_supplierId_key" ON "Shortlist"("workspaceKey", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierNote_workspaceKey_supplierId_idx" ON "SupplierNote"("workspaceKey", "supplierId");

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSource" ADD CONSTRAINT "SupplierSource_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierNote" ADD CONSTRAINT "SupplierNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

