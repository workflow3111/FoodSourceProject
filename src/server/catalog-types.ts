import type {
  CertificateStatus,
  CertificateVerificationStatus,
  ContactMethod,
  ContactStatus,
  ContactType,
  DataType,
  SourceType,
  SupplierType,
  VerificationStatus,
} from "@/generated/prisma/client";
import type { ProductType } from "@/lib/product-type";

export type CatalogProduct = {
  id: string;
  name: string;
  categorySlug: string;
  categoryNameRu: string;
  categoryNameEn: string;
  price: number | null;
  currency: string;
  moq: number | null;
  unit: string | null;
  deliveryNotes: string | null;
  imageUrl: string | null;
  productType: ProductType;
  dataType: DataType;
  priceUpdatedAt: string | null;
};

export type CatalogCertification = {
  id: string;
  name: string;
  certificateNumber: string | null;
  documentUrl: string | null;
  sourceUrl: string | null;
  issuer: string | null;
  /** Status stored in the database. Suspension and revocation are kept here. */
  recordedStatus: CertificateStatus;
  /** Status shown in the catalog. Recalculated from the expiration date on each read. */
  certificateStatus: CertificateStatus;
  verificationStatus: CertificateVerificationStatus;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verificationNotes: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  isDemo: boolean;
};

export type CatalogContact = {
  id: string;
  type: ContactType;
  label: string | null;
  value: string;
};

export type CatalogSource = {
  id: string;
  sourceType: SourceType;
  url: string;
  title: string | null;
  evidence: string | null;
  checkedAt: string | null;
};

export type CatalogSupplier = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  supplierType: SupplierType;
  city: string | null;
  region: string | null;
  country: string;
  address: string | null;
  website: string | null;
  sourceUrl: string | null;
  dataType: DataType;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  products: CatalogProduct[];
  contacts: CatalogContact[];
  certifications: CatalogCertification[];
  sources: CatalogSource[];
  minPrice: number | null;
  minMoq: number | null;
};

export type WorkspaceNote = {
  id: string;
  supplierId: string;
  content: string;
  updatedAt: string;
};

export type WorkspaceEntry = {
  supplierId: string;
  contactStatus: ContactStatus;
  lastContactOn: string | null;
  nextFollowUpOn: string | null;
  contactPerson: string | null;
  contactMethod: ContactMethod | null;
  updatedAt: string;
  notes: WorkspaceNote[];
};

export class DataError extends Error {
  constructor() {
    super("The catalog could not be loaded.");
    this.name = "DataError";
  }
}
