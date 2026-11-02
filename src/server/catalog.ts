import { demoWorkspaceKey } from "@/config/site";
import type { ContactStatus } from "@/generated/prisma/client";
import { resolveCertificateStatus } from "@/lib/certificate-status";
import { serverTimeZone } from "@/lib/freshness";
import { connection } from "next/server.js";
import {
  hasRankingContext,
  type DiscoveryQuery,
} from "@/lib/discovery-query";
import { isProductType, productTypes, type ProductType } from "@/lib/product-type";
import { getPrisma } from "@/lib/prisma";
import { matchSuppliers, type MatchContext, type MatchReport } from "@/server/matching";
import { discoveryPageSize, queryMatchCohort, querySupplierIds, querySupplierPage } from "@/server/supplier-search";
import {
  DataError,
  type CatalogProduct,
  type CatalogSupplier,
  type WorkspaceEntry,
  type WorkspaceNote,
} from "@/server/catalog-types";

const supplierInclude = {
  products: {
    include: { category: true },
    orderBy: { name: "asc" as const },
  },
  contacts: { orderBy: { type: "asc" as const } },
  certifications: { orderBy: { name: "asc" as const } },
  sources: { orderBy: { isPrimary: "desc" as const } },
};

type SupplierRow = Awaited<
  ReturnType<ReturnType<typeof getPrisma>["supplier"]["findMany"]>
>[number];

function calendarDate(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function asNumber(value: { toString(): string } | null | undefined) {
  if (value == null) {
    return null;
  }

  const number = Number(value.toString());
  return Number.isFinite(number) ? number : null;
}

function mapSupplier(row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  supplierType: CatalogSupplier["supplierType"];
  city: string | null;
  region: string | null;
  country: string;
  address: string | null;
  website: string | null;
  sourceUrl: string | null;
  dataType: CatalogSupplier["dataType"];
  verificationStatus: CatalogSupplier["verificationStatus"];
  lastVerifiedAt: Date | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  products: Array<{
    id: string;
    name: string;
    estimatedPrice: { toString(): string } | null;
    currency: string;
    minimumOrderQuantity: { toString(): string } | null;
    unit: string | null;
    deliveryNotes: string | null;
    imageUrl: string | null;
    productType: CatalogProduct["productType"];
    dataType: CatalogProduct["dataType"];
    priceUpdatedAt: Date | null;
    category: { slug: string; nameRu: string; nameEn: string };
  }>;
  contacts: CatalogSupplier["contacts"];
  certifications: Array<{
    id: string;
    name: string;
    certificateNumber: string | null;
    documentUrl: string | null;
    sourceUrl: string | null;
    issuer: string | null;
    certificateStatus: CatalogSupplier["certifications"][number]["recordedStatus"];
    verificationStatus: CatalogSupplier["certifications"][number]["verificationStatus"];
    verifiedAt: Date | null;
    verifiedBy: string | null;
    verificationNotes: string | null;
    issuedAt: Date | null;
    expiresAt: Date | null;
    isDemo: boolean;
  }>;
  sources: Array<{
    id: string;
    sourceType: CatalogSupplier["sources"][number]["sourceType"];
    url: string;
    title: string | null;
    evidence: string | null;
    checkedAt: Date | null;
  }>;
}, now: Date): CatalogSupplier {
  const timeZone = serverTimeZone();
  const products = row.products.map((product) => ({
    id: product.id,
    name: product.name,
    categorySlug: product.category.slug,
    categoryNameRu: product.category.nameRu,
    categoryNameEn: product.category.nameEn,
    price: asNumber(product.estimatedPrice),
    currency: product.currency,
    moq: asNumber(product.minimumOrderQuantity),
    unit: product.unit,
    deliveryNotes: product.deliveryNotes,
    imageUrl: product.imageUrl,
    productType: product.productType,
    dataType: product.dataType,
    priceUpdatedAt: product.priceUpdatedAt?.toISOString() ?? null,
  }));
  const prices = products.flatMap((product) => (product.price == null ? [] : [product.price]));
  const moqs = products.flatMap((product) => (product.moq == null ? [] : [product.moq]));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    supplierType: row.supplierType,
    city: row.city,
    region: row.region,
    country: row.country,
    address: row.address,
    website: row.website,
    sourceUrl: row.sourceUrl,
    dataType: row.dataType,
    verificationStatus: row.verificationStatus,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    logoUrl: row.logoUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
    products,
    contacts: row.contacts,
    certifications: row.certifications.map((item) => ({
      id: item.id,
      name: item.name,
      certificateNumber: item.certificateNumber,
      documentUrl: item.documentUrl,
      sourceUrl: item.sourceUrl,
      issuer: item.issuer,
      recordedStatus: item.certificateStatus,
      certificateStatus: resolveCertificateStatus(item.certificateStatus, item.expiresAt, now, timeZone),
      verificationStatus: item.verificationStatus,
      verifiedAt: item.verifiedAt?.toISOString() ?? null,
      verifiedBy: item.verifiedBy,
      verificationNotes: item.verificationNotes,
      issuedAt: item.issuedAt?.toISOString() ?? null,
      expiresAt: item.expiresAt?.toISOString() ?? null,
      isDemo: item.isDemo,
    })),
    sources: row.sources.map((source) => ({
      id: source.id,
      sourceType: source.sourceType,
      url: source.url,
      title: source.title,
      evidence: source.evidence,
      checkedAt: source.checkedAt?.toISOString() ?? null,
    })),
    minPrice: prices.length ? Math.min(...prices) : null,
    minMoq: moqs.length ? Math.min(...moqs) : null,
  };
}

async function catalogNow() {
  try {
    await connection();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("outside a request scope")) throw error;
  }
  return new Date();
}

async function readCatalog() {
  try {
    const now = await catalogNow();
    const rows = await getPrisma().supplier.findMany({
      where: { isActive: true },
      include: supplierInclude,
      orderBy: { name: "asc" },
    });

    return rows.map((row) => mapSupplier(row as SupplierRow & Parameters<typeof mapSupplier>[0], now));
  } catch (error) {
    console.error(error);
    throw new DataError();
  }
}

export async function getCatalog() {
  return readCatalog();
}

export async function getSupplier(slug: string) {
  try {
    const now = await catalogNow();
    const row = await getPrisma().supplier.findFirst({
      where: { slug, isActive: true },
      include: supplierInclude,
    });
    return row ? mapSupplier(row as Parameters<typeof mapSupplier>[0], now) : null;
  } catch (error) {
    console.error(error);
    throw new DataError();
  }
}

export async function getSuppliersBySlugs(slugs: string[]) {
  if (!slugs.length) return [];

  try {
    const now = await catalogNow();
    const rows = await getPrisma().supplier.findMany({
      where: { slug: { in: slugs }, isActive: true },
      include: supplierInclude,
    });
    const bySlug = new Map(rows.map((row) => [row.slug, mapSupplier(row as Parameters<typeof mapSupplier>[0], now)]));
    return slugs.flatMap((slug) => {
      const supplier = bySlug.get(slug);
      return supplier ? [supplier] : [];
    });
  } catch (error) {
    console.error(error);
    throw new DataError();
  }
}

export async function searchSuppliers(query: DiscoveryQuery) {
  try {
    const now = await catalogNow();
    const facets = await loadFacets();
    const showScore = hasRankingContext(query) || query.sort === "match";
    const [ids, cohort] = await Promise.all([querySupplierIds(query), queryMatchCohort(query)]);
    const population = await loadSuppliersByIds(ids, now);
    const reports = new Map(
      matchSuppliers(population, toMatchContext(query), cohort).map((report) => [report.supplierId, report]),
    );

    if (query.sort === "match") {
      const ranked = [...population].sort((left, right) => compareByMatch(left, right, reports));
      const pages = Math.max(1, Math.ceil(ranked.length / discoveryPageSize));
      const page = Math.min(query.page, pages);
      const start = (page - 1) * discoveryPageSize;
      return {
        items: ranked.slice(start, start + discoveryPageSize).map((supplier) => scoredItem(supplier, reports)),
        total: ranked.length,
        page,
        pages,
        showScore: true,
        comparable: null,
        facets,
      };
    }

    const page = await querySupplierPage(query);
    const byId = new Map(population.map((supplier) => [supplier.id, supplier]));
    return {
      items: page.ids.flatMap((id) => {
        const supplier = byId.get(id);
        return supplier ? [scoredItem(supplier, reports)] : [];
      }),
      total: page.total,
      page: page.page,
      pages: page.pages,
      showScore,
      comparable: page.comparable,
      facets,
    };
  } catch (error) {
    console.error(error);
    throw new DataError();
  }
}

export async function scoreSupplier(supplier: CatalogSupplier, query: DiscoveryQuery) {
  const now = await catalogNow();
  const [ids, cohort] = await Promise.all([querySupplierIds(query), queryMatchCohort(query)]);
  const peers = await loadSuppliersByIds(ids, now);
  const population = peers.some((item) => item.id === supplier.id) ? peers : [...peers, supplier];
  return (
    matchSuppliers(population, toMatchContext(query), cohort).find((report) => report.supplierId === supplier.id) ??
    null
  );
}

function toMatchContext(query: DiscoveryQuery): MatchContext {
  return {
    query: query.q || undefined,
    category: query.category || undefined,
    city: query.city || undefined,
    region: query.region || undefined,
    maxPrice: query.maxPrice,
    maxMoq: query.maxMoq,
    certified: query.certified,
  };
}

function scoredItem(supplier: CatalogSupplier, reports: Map<string, MatchReport>) {
  const report = reports.get(supplier.id) ?? null;
  return { supplier, score: report?.score ?? null, report };
}

function compareByMatch(left: CatalogSupplier, right: CatalogSupplier, reports: Map<string, MatchReport>) {
  const leftReport = reports.get(left.id);
  const rightReport = reports.get(right.id);
  const leftScore = leftReport?.score ?? null;
  const rightScore = rightReport?.score ?? null;
  if (leftScore == null && rightScore == null) return byNameThenId(left, right);
  if (leftScore == null) return 1;
  if (rightScore == null) return -1;
  if (leftScore !== rightScore) return rightScore - leftScore;
  const coverageGap = (rightReport?.coverage ?? 0) - (leftReport?.coverage ?? 0);
  if (coverageGap !== 0) return coverageGap;
  return byNameThenId(left, right);
}

function byNameThenId(left: CatalogSupplier, right: CatalogSupplier) {
  return left.name.localeCompare(right.name, "ru") || left.id.localeCompare(right.id);
}

async function loadSuppliersByIds(ids: string[], now: Date) {
  if (!ids.length) return [];
  const rows = await getPrisma().supplier.findMany({
    where: { id: { in: ids }, isActive: true },
    include: supplierInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, mapSupplier(row as Parameters<typeof mapSupplier>[0], now)]));
  return ids.flatMap((id) => {
    const supplier = byId.get(id);
    return supplier ? [supplier] : [];
  });
}

export async function getDashboard(now: Date) {
  try {
    const prisma = getPrisma();
    const [supplierCount, categoryCount, savedCount, regions, recentRows, popular, productTypeCounts] = await Promise.all([
      prisma.supplier.count({ where: { isActive: true } }),
      prisma.category.count(),
      prisma.shortlist.count({ where: { workspaceKey: demoWorkspaceKey } }),
      prisma.supplier.findMany({
        where: { isActive: true, region: { not: null } },
        distinct: ["region"],
        select: { region: true },
      }),
      prisma.supplier.findMany({
        where: { isActive: true },
        include: supplierInclude,
        orderBy: [{ createdAt: "desc" }, { name: "asc" }],
        take: 5,
      }),
      categoryCounts(),
      productTypeSupplierCounts(),
    ]);

    return {
      supplierCount,
      categoryCount,
      regionCount: regions.length,
      savedCount,
      recent: recentRows.map((row) => mapSupplier(row as Parameters<typeof mapSupplier>[0], now)),
      popular,
      productTypeCounts,
    };
  } catch (error) {
    console.error(error);
    throw new DataError();
  }
}

export async function getProductTypeCounts() {
  try {
    return await productTypeSupplierCounts();
  } catch (error) {
    console.error(error);
    throw new DataError();
  }
}

async function productTypeSupplierCounts() {
  const rows = await getPrisma().$queryRaw<Array<{ productType: string; count: number }>>`
    SELECT p."productType"::text AS "productType", COUNT(DISTINCT p."supplierId")::int AS count
    FROM "SupplierProduct" p
    JOIN "Supplier" s ON s."id" = p."supplierId" AND s."isActive" = true
    GROUP BY p."productType"
  `;
  const counts = Object.fromEntries(productTypes.map((type) => [type, 0])) as Record<ProductType, number>;

  for (const row of rows) {
    if (isProductType(row.productType)) counts[row.productType] = row.count;
  }

  return counts;
}

export async function getCategories() {
  try {
    return await categoryCounts();
  } catch (error) {
    console.error(error);
    throw new DataError();
  }
}

export async function getWorkspace(): Promise<WorkspaceEntry[]> {
  try {
    const [shortlists, notes] = await Promise.all([
      getPrisma().shortlist.findMany({
        where: { workspaceKey: demoWorkspaceKey },
        orderBy: { updatedAt: "desc" },
      }),
      getPrisma().supplierNote.findMany({
        where: { workspaceKey: demoWorkspaceKey },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const notesBySupplier = new Map<string, WorkspaceNote[]>();

    for (const note of notes) {
      const list = notesBySupplier.get(note.supplierId) ?? [];
      list.push({
        id: note.id,
        supplierId: note.supplierId,
        content: note.content,
        updatedAt: note.updatedAt.toISOString(),
      });
      notesBySupplier.set(note.supplierId, list);
    }

    return shortlists.map((entry) => ({
      supplierId: entry.supplierId,
      contactStatus: entry.contactStatus,
      lastContactOn: calendarDate(entry.lastContactOn),
      nextFollowUpOn: calendarDate(entry.nextFollowUpOn),
      contactPerson: entry.contactPerson,
      contactMethod: entry.contactMethod,
      updatedAt: entry.updatedAt.toISOString(),
      notes: notesBySupplier.get(entry.supplierId) ?? [],
    }));
  } catch (error) {
    console.error(error);
    throw new DataError();
  }
}

export async function getSavedIds() {
  const workspace = await getWorkspace();
  return new Set(workspace.map((entry) => entry.supplierId));
}

async function loadFacets() {
  const prisma = getPrisma();
  const [categories, cities, regions] = await Promise.all([
    categoryCounts(),
    prisma.supplier.findMany({
      where: { isActive: true, city: { not: null } },
      distinct: ["city"],
      select: { city: true },
    }),
    prisma.supplier.findMany({
      where: { isActive: true, region: { not: null } },
      distinct: ["region"],
      select: { region: true },
    }),
  ]);

  return {
    categories,
    cities: cities
      .flatMap((row) => (row.city ? [row.city] : []))
      .sort((left, right) => left.localeCompare(right, "ru")),
    regions: regions
      .flatMap((row) => (row.region ? [row.region] : []))
      .sort((left, right) => left.localeCompare(right, "ru")),
  };
}

async function categoryCounts(limit?: number) {
  const rows = await getPrisma().$queryRaw<
    Array<{ slug: string; nameRu: string; nameEn: string; count: number }>
  >`
    SELECT c."slug", c."nameRu", c."nameEn", COUNT(DISTINCT p."supplierId")::int AS count
    FROM "Category" c
    JOIN "SupplierProduct" p ON p."categoryId" = c."id"
    JOIN "Supplier" s ON s."id" = p."supplierId" AND s."isActive" = true
    GROUP BY c."id", c."slug", c."nameRu", c."nameEn"
    ORDER BY count DESC, c."nameRu" ASC
  `;

  return limit ? rows.slice(0, limit) : rows;
}

export type { ContactStatus };
