import { compareLimit } from "@/lib/comparison";
import { toCsv } from "@/lib/csv";
import { calendarDateInZone, freshnessStatus, type FreshnessStatus } from "@/lib/freshness";
import type { ContactStatus } from "@/lib/contact-tracking";
import { matchSuppliers, type MatchContext } from "@/server/matching";
import type { ProductType } from "@/lib/product-type";
import type { CatalogSupplier, WorkspaceEntry } from "@/server/catalog-types";

export const comparisonExportColumns = [
  "name",
  "type",
  "categories",
  "products",
  "productTypes",
  "city",
  "region",
  "country",
  "website",
  "contactPerson",
  "email",
  "phone",
  "price",
  "currency",
  "priceUnit",
  "moq",
  "certifications",
  "deliveryRegions",
  "deliveryTerms",
  "score",
  "contactStatus",
  "freshness",
  "updated",
  "sourceUrl",
] as const;

export type ComparisonExportColumn = (typeof comparisonExportColumns)[number];

export type ComparisonExportLabels = {
  columns: Record<ComparisonExportColumn, string>;
  missing: string;
  supplierType: Record<CatalogSupplier["supplierType"], string>;
  productType: Record<ProductType, string>;
  contactStatus: Record<ContactStatus, string>;
  freshness: Record<FreshnessStatus, string>;
};

export function buildComparisonCsv({
  suppliers,
  workspace,
  context,
  labels,
  locale,
  now,
  timeZone,
}: {
  suppliers: CatalogSupplier[];
  workspace: Pick<WorkspaceEntry, "supplierId" | "contactStatus" | "contactPerson">[];
  context?: MatchContext;
  labels: ComparisonExportLabels;
  locale: "ru" | "en";
  now: Date;
  timeZone: string;
}) {
  const selected = suppliers.slice(0, compareLimit);
  const reports = new Map(matchSuppliers(selected, context).map((report) => [report.supplierId, report]));
  const saved = new Map(workspace.map((entry) => [entry.supplierId, entry]));
  const header = comparisonExportColumns.map((column) => labels.columns[column]);
  const rows = selected.map((supplier) =>
    comparisonExportColumns.map((column) => cell(column, supplier, reports.get(supplier.id), saved.get(supplier.id), labels, locale, now, timeZone)),
  );
  return toCsv([header, ...rows]);
}

function cell(
  column: ComparisonExportColumn,
  supplier: CatalogSupplier,
  report: ReturnType<typeof matchSuppliers>[number] | undefined,
  entry: Pick<WorkspaceEntry, "contactStatus" | "contactPerson"> | undefined,
  labels: ComparisonExportLabels,
  locale: "ru" | "en",
  now: Date,
  timeZone: string,
) {
  const missing = labels.missing;
  const categoryKey = locale === "en" ? "categoryNameEn" : "categoryNameRu";
  switch (column) {
    case "name":
      return supplier.name;
    case "type":
      return labels.supplierType[supplier.supplierType];
    case "categories":
      return join(unique(supplier.products.map((product) => product[categoryKey])), missing);
    case "products":
      return join(unique(supplier.products.map((product) => product.name)), missing);
    case "productTypes":
      return join(unique(supplier.products.map((product) => labels.productType[product.productType])), missing);
    case "city":
      return text(supplier.city, missing);
    case "region":
      return text(supplier.region, missing);
    case "country":
      return text(supplier.country, missing);
    case "website":
      return text(supplier.website, missing);
    case "contactPerson":
      return text(entry?.contactPerson, missing);
    case "email":
      return join(values(supplier, "EMAIL"), missing);
    case "phone":
      return join(values(supplier, "PHONE"), missing);
    case "price":
      return report?.price.amount == null ? missing : decimal(report.price.amount);
    case "currency":
      return report?.price.amount == null ? missing : text(report.price.currency, missing);
    case "priceUnit":
      return report?.price.amount == null ? missing : text(report.price.unit, missing);
    case "moq":
      return report?.moq.amount == null ? missing : quantity(report.moq.amount, report.moq.unit);
    case "certifications":
      return join(unique(supplier.certifications.map((item) => item.name)), missing);
    case "deliveryRegions":
      return missing;
    case "deliveryTerms":
      return join(unique(supplier.products.flatMap((product) => (product.deliveryNotes ? [product.deliveryNotes] : []))), missing);
    case "score":
      return report?.score == null ? missing : String(report.score);
    case "contactStatus":
      return entry ? labels.contactStatus[entry.contactStatus] : missing;
    case "freshness":
      return labels.freshness[freshnessStatus(supplier.updatedAt, now, timeZone)];
    case "updated":
      return supplier.updatedAt ? calendarDateInZone(new Date(supplier.updatedAt), timeZone) ?? missing : missing;
    case "sourceUrl":
      return text(supplier.sources[0]?.url ?? supplier.sourceUrl, missing);
  }
}

function values(supplier: CatalogSupplier, type: "EMAIL" | "PHONE") {
  return supplier.contacts.filter((contact) => contact.type === type).map((contact) => contact.value);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function join(values: string[], missing: string) {
  return values.length ? values.join("; ") : missing;
}

function text(value: string | null | undefined, missing: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed || missing;
}

function decimal(value: number) {
  if (!Number.isFinite(value)) return "";
  return String(Number(value.toFixed(3)));
}

function quantity(amount: number, unit: string | null) {
  const number = decimal(amount);
  const trimmed = unit?.trim() ?? "";
  return trimmed ? `${number} ${trimmed}` : number;
}
