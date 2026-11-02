import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { productTypes } from "@/lib/product-type";

const supplierTypes = [
  "MANUFACTURER",
  "DISTRIBUTOR",
  "FARM",
  "IMPORTER",
  "PACKAGING",
  "WHOLESALER",
  "OTHER",
] as const;

const idSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  categorySlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  productType: z.enum(productTypes),
  estimatedPrice: z.number().nonnegative().nullable(),
  minimumOrderQuantity: z.number().nonnegative().nullable(),
  unit: z.string().trim().max(40).nullable(),
  deliveryNotes: z.string().trim().max(500).nullable(),
});

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(4000).nullable(),
  supplierType: z.enum(supplierTypes),
  city: z.string().trim().max(120).nullable(),
  region: z.string().trim().max(160).nullable(),
  address: z.string().trim().max(400).nullable(),
  website: z.url().nullable(),
  sourceUrl: z.url(),
  dataType: z.enum(["REAL", "DEMO"]),
  products: z.array(productSchema).min(1).max(40),
});

export type SupplierWriteInput = z.input<typeof supplierSchema>;

async function categoryIds(slugs: string[]) {
  const rows = await getPrisma().category.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row.id]));
  const missing = slugs.filter((slug) => !bySlug.has(slug));
  if (missing.length) {
    throw new Error(`Unknown category: ${missing.join(", ")}`);
  }
  return bySlug;
}

function productRows(
  products: z.output<typeof supplierSchema>["products"],
  categories: Map<string, string>,
  dataType: "REAL" | "DEMO",
) {
  return products.map((product) => ({
    id: randomUUID(),
    categoryId: categories.get(product.categorySlug) ?? "",
    name: product.name,
    estimatedPrice: product.estimatedPrice,
    currency: "RUB",
    minimumOrderQuantity: product.minimumOrderQuantity,
    unit: product.unit,
    deliveryNotes: product.deliveryNotes,
    isAvailable: dataType === "DEMO" ? true : null,
    productType: product.productType,
    dataType,
    priceUpdatedAt: product.estimatedPrice == null ? null : new Date(),
  }));
}

export async function createSupplier(input: SupplierWriteInput) {
  const data = supplierSchema.parse(input);
  const categories = await categoryIds(data.products.map((product) => product.categorySlug));

  return getPrisma().supplier.create({
    data: {
      id: randomUUID(),
      name: data.name,
      slug: data.slug,
      description: data.description,
      supplierType: data.supplierType,
      city: data.city,
      region: data.region,
      country: "Россия",
      address: data.address,
      website: data.website,
      sourceUrl: data.sourceUrl,
      dataType: data.dataType,
      verificationStatus: data.dataType === "REAL" ? "PARTIALLY_VERIFIED" : "UNVERIFIED",
      lastVerifiedAt: data.dataType === "REAL" ? new Date() : null,
      isActive: true,
      products: { create: productRows(data.products, categories, data.dataType) },
      sources: {
        create: {
          id: randomUUID(),
          sourceType: data.dataType === "REAL" ? "OFFICIAL_WEBSITE" : "DEMO",
          url: data.sourceUrl,
          title: data.dataType === "REAL" ? "Официальный сайт" : "Демонстрационная карточка",
          evidence:
            data.dataType === "REAL"
              ? "Source URL stored with the record."
              : "Demonstration record. This URL is not a citation of a real offer.",
          isPrimary: true,
          checkedAt: new Date(),
        },
      },
    },
    select: { id: true, slug: true },
  });
}

export async function updateSupplier(id: string, input: SupplierWriteInput) {
  const supplierId = idSchema.parse(id);
  const data = supplierSchema.parse(input);
  const categories = await categoryIds(data.products.map((product) => product.categorySlug));
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    await tx.supplierProduct.deleteMany({ where: { supplierId } });
    const supplier = await tx.supplier.update({
      where: { id: supplierId },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        supplierType: data.supplierType,
        city: data.city,
        region: data.region,
        address: data.address,
        website: data.website,
        sourceUrl: data.sourceUrl,
        dataType: data.dataType,
        verificationStatus: data.dataType === "REAL" ? "PARTIALLY_VERIFIED" : "UNVERIFIED",
        products: { create: productRows(data.products, categories, data.dataType) },
      },
      select: { id: true, slug: true },
    });
    return supplier;
  });
}

export async function deleteSupplier(id: string) {
  const supplierId = idSchema.parse(id);
  await getPrisma().supplier.delete({ where: { id: supplierId } });
}
