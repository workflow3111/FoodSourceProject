import type { CatalogSupplier } from "@/server/catalog-types";

function filled(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

export function supplierCompleteness(supplier: CatalogSupplier) {
  const products = supplier.products;
  let score = 0;
  if (filled(supplier.description)) score += 1;
  if (filled(supplier.city)) score += 1;
  if (filled(supplier.region)) score += 1;
  if (filled(supplier.address)) score += 1;
  if (filled(supplier.website)) score += 1;
  if (filled(supplier.sourceUrl)) score += 1;
  if (supplier.supplierType !== "OTHER") score += 1;
  if (products.length > 0) score += 1;
  if (products.some((product) => product.price != null && product.price >= 0)) score += 1;
  if (products.some((product) => product.moq != null && product.moq >= 0)) score += 1;
  if (products.some((product) => filled(product.unit))) score += 1;
  if (products.some((product) => filled(product.deliveryNotes))) score += 1;
  if (supplier.contacts.length > 0) score += 1;
  if (supplier.certifications.length > 0) score += 1;
  if (supplier.sources.length > 0) score += 1;
  return score;
}
