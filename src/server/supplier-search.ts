import { Prisma } from "@/generated/prisma/client";
import { demoWorkspaceKey } from "@/config/site";
import { foldSearchText, type DiscoveryQuery, type SortKey } from "@/lib/discovery-query";
import { isCertificateFilter, type CertificateFilter } from "@/lib/certificate-status";
import { effectiveCertificateStatusSql } from "@/server/certificate-sql";
import { freshnessThresholds, isFreshnessStatus, serverTimeZone } from "@/lib/freshness";
import { getPrisma } from "@/lib/prisma";
import { cohortFromProductRows, sqlUnitKey } from "@/server/matching";

export const discoveryPageSize = 9;

const folded = {
  name: Prisma.raw(`translate(lower(s."name"), 'ё', 'е')`),
  city: Prisma.raw(`translate(lower(s."city"), 'ё', 'е')`),
  region: Prisma.raw(`translate(lower(s."region"), 'ё', 'е')`),
  product: Prisma.raw(`translate(lower(p."name"), 'ё', 'е')`),
  categoryRu: Prisma.raw(`translate(lower(c."nameRu"), 'ё', 'е')`),
  categoryEn: Prisma.raw(`translate(lower(c."nameEn"), 'ё', 'е')`),
};

function textMatch(query: DiscoveryQuery, like: string) {
  if (like === "%%") return null;
  const name = Prisma.sql`${folded.name} LIKE ${like}`;
  const place = Prisma.sql`(${folded.city} LIKE ${like} OR ${folded.region} LIKE ${like})`;
  const product = Prisma.sql`EXISTS (
    SELECT 1
    FROM "SupplierProduct" p
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."supplierId" = s."id"
      AND (
        ${folded.product} LIKE ${like}
        OR ${folded.categoryRu} LIKE ${like}
        OR ${folded.categoryEn} LIKE ${like}
      )
  )`;
  if (query.scope === "name") return name;
  if (query.scope === "place") return place;
  if (query.scope === "product") return product;
  return Prisma.sql`(${name} OR ${place} OR ${product})`;
}

function whereSql(query: DiscoveryQuery, like: string) {
  const filters = [Prisma.sql`s."isActive" = true`];

  const text = textMatch(query, like);
  if (text) filters.push(text);

  if (query.category) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM "SupplierProduct" p
      JOIN "Category" c ON c."id" = p."categoryId"
      WHERE p."supplierId" = s."id" AND c."slug" = ${query.category}
    )`);
  }

  if (query.city) filters.push(Prisma.sql`s."city" = ${query.city}`);
  if (query.region) filters.push(Prisma.sql`s."region" = ${query.region}`);
  if (query.type) filters.push(Prisma.sql`s."supplierType"::text = ${query.type}`);
  if (query.productType) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM "SupplierProduct" p
      WHERE p."supplierId" = s."id" AND p."productType"::text = ${query.productType}
    )`);
  }

  if (query.certified) {
    const effective = effectiveCertificateStatusSql(serverTimeZone());
    filters.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM "Certification" cert
      WHERE cert."supplierId" = s."id"
        AND s."dataType" = 'REAL'
        AND ${effective} NOT IN ('EXPIRED', 'SUSPENDED', 'REVOKED')
    )`);
  }

  if (isCertificateFilter(query.certificate)) {
    filters.push(certificateFilterSql(query.certificate));
  }

  if (query.contact) {
    const tracked = Prisma.sql`EXISTS (
      SELECT 1
      FROM "Shortlist" sl
      WHERE sl."supplierId" = s."id"
        AND sl."workspaceKey" = ${demoWorkspaceKey}
        AND sl."contactStatus"::text = ${query.contact}
    )`;
    filters.push(
      query.contact === "NOT_CONTACTED"
        ? Prisma.sql`(
            ${tracked}
            OR NOT EXISTS (
              SELECT 1
              FROM "Shortlist" sl
              WHERE sl."supplierId" = s."id"
                AND sl."workspaceKey" = ${demoWorkspaceKey}
            )
          )`
        : tracked,
    );
  }

  if (isFreshnessStatus(query.freshness)) {
    filters.push(Prisma.sql`${freshnessSql(serverTimeZone())} = ${query.freshness}`);
  }

  if (query.maxPrice != null) {
    filters.push(Prisma.sql`(
      SELECT MIN(p."estimatedPrice")
      FROM "SupplierProduct" p
      WHERE p."supplierId" = s."id"
    ) <= ${query.maxPrice}`);
  }

  if (query.maxMoq != null) {
    filters.push(Prisma.sql`(
      SELECT MIN(p."minimumOrderQuantity")
      FROM "SupplierProduct" p
      WHERE p."supplierId" = s."id"
    ) <= ${query.maxMoq}`);
  }

  return Prisma.join(filters, " AND ");
}

const filteredFrom = Prisma.sql`
  FROM "Supplier" s
  CROSS JOIN LATERAL (
    SELECT
      MIN(p."estimatedPrice") AS min_price,
      MIN(p."minimumOrderQuantity") AS min_moq
    FROM "SupplierProduct" p
    WHERE p."supplierId" = s."id"
  ) stats
`;

export async function querySupplierPage(query: DiscoveryQuery) {
  const foldedQuery = foldSearchText(query.q);
  const like = `%${foldedQuery}%`;
  const where = whereSql(query, like);
  const prisma = getPrisma();

  const [summary] = await prisma.$queryRaw<
    Array<{
      total: number;
      price_min: string | null;
      price_max: string | null;
      moq_min: string | null;
      moq_max: string | null;
    }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::int AS total,
      MIN(stats.min_price)::text AS price_min,
      MAX(stats.min_price)::text AS price_max,
      MIN(stats.min_moq)::text AS moq_min,
      MAX(stats.min_moq)::text AS moq_max
    ${filteredFrom}
    WHERE ${where}
  `);

  const total = summary?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / discoveryPageSize));
  const page = Math.min(query.page, pages);
  const offset = (page - 1) * discoveryPageSize;
  const offerKind = comparableKind(query.sort);
  const offerGroup = offerKind ? await comparableOfferGroup(query, offerKind) : null;

  const rows = total
    ? await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT s."id"
        ${filteredFrom}
        WHERE ${where}
        ORDER BY ${orderBySql(query, offerGroup, foldedQuery, like)}
        LIMIT ${discoveryPageSize} OFFSET ${offset}
      `)
    : [];

  return {
    ids: rows.map((row) => row.id),
    total,
    page,
    pages,
    priceRange: range(summary?.price_min, summary?.price_max),
    moqRange: range(summary?.moq_min, summary?.moq_max),
    comparable: offerKind ? offerGroup != null : null,
  };
}

export async function querySupplierIds(query: DiscoveryQuery) {
  const like = `%${foldSearchText(query.q)}%`;
  const where = whereSql(query, like);
  const rows = await getPrisma().$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT s."id"
    FROM "Supplier" s
    WHERE ${where}
    ORDER BY s."name" ASC, s."id" ASC
  `);
  return rows.map((row) => row.id);
}

export async function queryMatchCohort(query: DiscoveryQuery) {
  const like = `%${foldSearchText(query.q)}%`;
  const where = whereSql(query, like);
  const rows = await getPrisma().$queryRaw<
    Array<{ supplierId: string; unit: string | null; currency: string | null; price: string | null; moq: string | null }>
  >(Prisma.sql`
    SELECT p."supplierId" AS "supplierId",
           p."unit" AS unit,
           p."currency" AS currency,
           p."estimatedPrice"::text AS price,
           p."minimumOrderQuantity"::text AS moq
    FROM "Supplier" s
    JOIN "SupplierProduct" p ON p."supplierId" = s."id"
    WHERE ${where}
  `);

  return cohortFromProductRows(
    rows.map((row) => ({
      supplierId: row.supplierId,
      unit: row.unit,
      currency: row.currency,
      price: row.price == null ? null : Number(row.price),
      moq: row.moq == null ? null : Number(row.moq),
    })),
  );
}

export type ComparableOfferGroup = {
  category: string;
  unit: string;
  currency: string | null;
};

function certificateFilterSql(filter: CertificateFilter) {
  const effective = effectiveCertificateStatusSql(serverTimeZone());
  const predicate =
    filter === "verified"
      ? Prisma.sql`cert."verificationStatus"::text = 'VERIFIED' AND cert."isDemo" = false`
      : filter === "valid"
        ? Prisma.sql`${effective} = 'VALID'`
        : filter === "expiring"
          ? Prisma.sql`${effective} = 'EXPIRING_SOON'`
          : filter === "expired"
            ? Prisma.sql`${effective} = 'EXPIRED'`
            : Prisma.sql`cert."verificationStatus"::text = 'UNVERIFIED'`;
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM "Certification" cert
    WHERE cert."supplierId" = s."id"
      AND ${predicate}
  )`;
}

function freshnessSql(timeZone: string) {
  return Prisma.sql`
    CASE
      WHEN s."updatedAt" IS NULL THEN 'unknown'
      WHEN ((s."updatedAt" AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone})::date
           > (CURRENT_TIMESTAMP AT TIME ZONE ${timeZone})::date THEN 'unknown'
      WHEN (CURRENT_TIMESTAMP AT TIME ZONE ${timeZone})::date
           - ((s."updatedAt" AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone})::date
           <= ${freshnessThresholds.freshDays} THEN 'fresh'
      WHEN (CURRENT_TIMESTAMP AT TIME ZONE ${timeZone})::date
           - ((s."updatedAt" AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone})::date
           <= ${freshnessThresholds.agingDays} THEN 'aging'
      ELSE 'stale'
    END
  `;
}

function comparableKind(sort: SortKey): "price" | "moq" | null {
  if (sort === "price" || sort === "price-desc") return "price";
  if (sort === "moq" || sort === "moq-desc") return "moq";
  return null;
}

export async function comparableOfferGroup(
  query: DiscoveryQuery,
  kind: "price" | "moq",
): Promise<ComparableOfferGroup | null> {
  const like = `%${foldSearchText(query.q)}%`;
  const where = whereSql(query, like);
  const amount = kind === "price" ? Prisma.sql`p."estimatedPrice"` : Prisma.sql`p."minimumOrderQuantity"`;
  const currencySelect =
    kind === "price"
      ? Prisma.sql`COALESCE(NULLIF(upper(btrim(p."currency")), ''), 'RUB')`
      : Prisma.sql`NULL`;
  const rows = await getPrisma().$queryRaw<
    Array<{ category: string | null; unit_key: string | null; currency: string | null; suppliers: number }>
  >(Prisma.sql`
    SELECT c."slug" AS category,
           ${Prisma.raw(sqlUnitKey(`p."unit"`))} AS unit_key,
           ${currencySelect} AS currency,
           COUNT(DISTINCT p."supplierId")::int AS suppliers
    FROM "Supplier" s
    JOIN "SupplierProduct" p ON p."supplierId" = s."id"
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE ${where}
      AND ${amount} IS NOT NULL
      AND ${amount} >= 0
      AND (${query.category} = '' OR c."slug" = ${query.category})
      AND (${query.productType} = '' OR p."productType"::text = ${query.productType})
    GROUP BY 1, 2, 3
    ORDER BY suppliers DESC, category ASC, unit_key ASC, currency ASC
  `);
  const comparable = rows.filter((row) => row.category && row.unit_key);
  const [best, next] = comparable;
  if (!best?.category || !best.unit_key) return null;
  if (next && next.suppliers === best.suppliers) return null;
  return { category: best.category, unit: best.unit_key, currency: kind === "price" ? best.currency : null };
}

function orderBySql(
  query: DiscoveryQuery,
  group: ComparableOfferGroup | null,
  foldedQuery: string,
  like: string,
) {
  const nameThenId = Prisma.sql`s."name" ASC, s."id" ASC`;
  switch (query.sort) {
    case "name-desc":
      return Prisma.sql`s."name" DESC, s."id" ASC`;
    case "updated":
      return Prisma.sql`s."updatedAt" DESC NULLS LAST, ${nameThenId}`;
    case "created":
      return Prisma.sql`s."createdAt" DESC NULLS LAST, ${nameThenId}`;
    case "complete":
      return Prisma.sql`${completenessSql} DESC, ${nameThenId}`;
    case "price":
    case "price-desc":
      return Prisma.sql`${offerAmountSql(group, "price", query.productType)} ${query.sort === "price-desc" ? Prisma.raw("DESC") : Prisma.raw("ASC")} NULLS LAST, ${nameThenId}`;
    case "moq":
    case "moq-desc":
      return Prisma.sql`${offerAmountSql(group, "moq", query.productType)} ${query.sort === "moq-desc" ? Prisma.raw("DESC") : Prisma.raw("ASC")} NULLS LAST, ${nameThenId}`;
    case "relevance":
      return Prisma.sql`
        CASE
          WHEN ${foldedQuery} <> '' AND ${folded.name} LIKE ${like} THEN 0
          WHEN ${foldedQuery} <> '' THEN 1
          ELSE 2
        END,
        ${nameThenId}
      `;
    default:
      return nameThenId;
  }
}

function offerAmountSql(group: ComparableOfferGroup | null, kind: "price" | "moq", productType = "") {
  if (!group) return Prisma.sql`NULL::numeric`;
  const amount = kind === "price" ? Prisma.sql`p."estimatedPrice"` : Prisma.sql`p."minimumOrderQuantity"`;
  const currencySql =
    kind === "price"
      ? Prisma.sql`AND COALESCE(NULLIF(upper(btrim(p."currency")), ''), 'RUB') = ${group.currency ?? ""}`
      : Prisma.empty;
  return Prisma.sql`(
    SELECT MIN(${amount})
    FROM "SupplierProduct" p
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."supplierId" = s."id"
      AND ${amount} IS NOT NULL
      AND ${amount} >= 0
      AND c."slug" = ${group.category}
      AND ${Prisma.raw(sqlUnitKey(`p."unit"`))} = ${group.unit}
      ${currencySql}
      ${productType ? Prisma.sql`AND p."productType"::text = ${productType}` : Prisma.empty}
  )`;
}

const completenessSql = Prisma.sql`(
  (CASE WHEN btrim(coalesce(s."description", '')) <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN btrim(coalesce(s."city", '')) <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN btrim(coalesce(s."region", '')) <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN btrim(coalesce(s."address", '')) <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN btrim(coalesce(s."website", '')) <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN btrim(coalesce(s."sourceUrl", '')) <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN s."supplierType"::text <> 'OTHER' THEN 1 ELSE 0 END) +
  (CASE WHEN EXISTS (SELECT 1 FROM "SupplierProduct" p WHERE p."supplierId" = s."id") THEN 1 ELSE 0 END) +
  (CASE WHEN EXISTS (
    SELECT 1 FROM "SupplierProduct" p
    WHERE p."supplierId" = s."id" AND p."estimatedPrice" IS NOT NULL AND p."estimatedPrice" >= 0
  ) THEN 1 ELSE 0 END) +
  (CASE WHEN EXISTS (
    SELECT 1 FROM "SupplierProduct" p
    WHERE p."supplierId" = s."id" AND p."minimumOrderQuantity" IS NOT NULL AND p."minimumOrderQuantity" >= 0
  ) THEN 1 ELSE 0 END) +
  (CASE WHEN EXISTS (
    SELECT 1 FROM "SupplierProduct" p
    WHERE p."supplierId" = s."id" AND btrim(coalesce(p."unit", '')) <> ''
  ) THEN 1 ELSE 0 END) +
  (CASE WHEN EXISTS (
    SELECT 1 FROM "SupplierProduct" p
    WHERE p."supplierId" = s."id" AND btrim(coalesce(p."deliveryNotes", '')) <> ''
  ) THEN 1 ELSE 0 END) +
  (CASE WHEN EXISTS (SELECT 1 FROM "SupplierContact" contact WHERE contact."supplierId" = s."id") THEN 1 ELSE 0 END) +
  (CASE WHEN EXISTS (SELECT 1 FROM "Certification" cert WHERE cert."supplierId" = s."id") THEN 1 ELSE 0 END) +
  (CASE WHEN EXISTS (SELECT 1 FROM "SupplierSource" src WHERE src."supplierId" = s."id") THEN 1 ELSE 0 END)
)`;

function range(min: string | null | undefined, max: string | null | undefined) {
  if (min == null || max == null) return null;
  const low = Number(min);
  const high = Number(max);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return { min: low, max: high };
}
