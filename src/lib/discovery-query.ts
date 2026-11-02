import { z } from "zod";
import { isCertificateFilter, type CertificateFilter } from "@/lib/certificate-status";
import { isContactStatus, type ContactStatus } from "@/lib/contact-tracking";
import { isFreshnessStatus, type FreshnessStatus } from "@/lib/freshness";
import { isProductType, type ProductType } from "@/lib/product-type";

export const sortOptions = [
  { value: "match", label: "sortMatch" },
  { value: "name", label: "sortName" },
  { value: "name-desc", label: "sortNameDesc" },
  { value: "price", label: "sortPrice" },
  { value: "price-desc", label: "sortPriceDesc" },
  { value: "moq", label: "sortMoq" },
  { value: "moq-desc", label: "sortMoqDesc" },
  { value: "updated", label: "sortUpdated" },
  { value: "created", label: "sortCreated" },
  { value: "complete", label: "sortComplete" },
  { value: "relevance", label: "sortRelevance" },
] as const;

const sorts = sortOptions.map((option) => option.value);
const scopes = ["all", "name", "product", "place"] as const;
const supplierTypes = [
  "MANUFACTURER",
  "DISTRIBUTOR",
  "FARM",
  "IMPORTER",
  "PACKAGING",
  "WHOLESALER",
  "OTHER",
] as const;

export type SortKey = (typeof sorts)[number];
export type SearchScope = (typeof scopes)[number];
export type SupplierTypeFilter = (typeof supplierTypes)[number];

export type DiscoveryQuery = {
  q: string;
  scope: SearchScope;
  category: string;
  city: string;
  region: string;
  type: SupplierTypeFilter | "";
  productType: ProductType | "";
  certified: boolean;
  certificate: CertificateFilter | "";
  contact: ContactStatus | "";
  freshness: FreshnessStatus | "";
  maxPrice: number | null;
  maxMoq: number | null;
  sort: SortKey;
  page: number;
};

const inputSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  scope: z.string().trim().max(20).optional().default(""),
  category: z.string().trim().max(80).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  region: z.string().trim().max(160).optional().default(""),
  type: z.string().trim().max(40).optional().default(""),
  productType: z.string().trim().max(40).optional().default(""),
  certified: z.string().trim().max(8).optional().default(""),
  certificate: z.string().trim().max(20).optional().default(""),
  contact: z.string().trim().max(40).optional().default(""),
  freshness: z.string().trim().max(20).optional().default(""),
  maxPrice: z.string().trim().max(20).optional().default(""),
  maxMoq: z.string().trim().max(20).optional().default(""),
  sort: z.string().trim().max(32).optional().default(""),
  page: z.string().trim().max(8).optional().default(""),
});

function first(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? "";
}

function numberOrNull(value: string) {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function isSort(value: string): value is SortKey {
  return sorts.some((sort) => sort === value);
}

function isScope(value: string): value is SearchScope {
  return scopes.some((scope) => scope === value);
}

function isSupplierType(value: string): value is SupplierTypeFilter {
  return supplierTypes.some((type) => type === value);
}

export function parseDiscoveryQuery(
  raw: Record<string, string | string[] | undefined>,
): DiscoveryQuery {
  const parsed = inputSchema.parse({
    q: first(raw.q),
    scope: first(raw.scope),
    category: first(raw.category),
    city: first(raw.city),
    region: first(raw.region),
    type: first(raw.type),
    productType: first(raw.productType),
    certified: first(raw.certified),
    certificate: first(raw.certificate),
    contact: first(raw.contact),
    freshness: first(raw.freshness),
    maxPrice: first(raw.maxPrice),
    maxMoq: first(raw.maxMoq),
    sort: first(raw.sort),
    page: first(raw.page),
  });
  const category = /^[a-z0-9-]*$/.test(parsed.category) ? parsed.category : "";
  const page = Number(parsed.page || "1");

  return {
    q: parsed.q,
    scope: isScope(parsed.scope) ? parsed.scope : "all",
    category,
    city: parsed.city,
    region: parsed.region,
    type: isSupplierType(parsed.type) ? parsed.type : "",
    productType: isProductType(parsed.productType) ? parsed.productType : "",
    certified: parsed.certified === "1",
    certificate: isCertificateFilter(parsed.certificate) ? parsed.certificate : "",
    contact: isContactStatus(parsed.contact) ? parsed.contact : "",
    freshness: isFreshnessStatus(parsed.freshness) ? parsed.freshness : "",
    maxPrice: numberOrNull(parsed.maxPrice),
    maxMoq: numberOrNull(parsed.maxMoq),
    sort: isSort(parsed.sort) ? parsed.sort : "name",
    page: Number.isInteger(page) && page > 0 && page <= 10000 ? page : 1,
  };
}

export function foldSearchText(value: string) {
  return value.toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/[%_\\]/g, "");
}

export function toSearchParams(query: DiscoveryQuery, page = query.page) {
  const params = new URLSearchParams();

  if (query.q) params.set("q", query.q);
  if (query.scope !== "all") params.set("scope", query.scope);
  if (query.category) params.set("category", query.category);
  if (query.city) params.set("city", query.city);
  if (query.region) params.set("region", query.region);
  if (query.type) params.set("type", query.type);
  if (query.productType) params.set("productType", query.productType);
  if (query.certified) params.set("certified", "1");
  if (query.certificate) params.set("certificate", query.certificate);
  if (query.contact) params.set("contact", query.contact);
  if (query.freshness) params.set("freshness", query.freshness);
  if (query.maxPrice != null) params.set("maxPrice", String(query.maxPrice));
  if (query.maxMoq != null) params.set("maxMoq", String(query.maxMoq));
  if (query.sort !== "name") params.set("sort", query.sort);
  if (page > 1) params.set("page", String(page));

  return params;
}

export function hasRankingContext(query: DiscoveryQuery) {
  return Boolean(
    query.q ||
      query.category ||
      query.city ||
      query.region ||
      query.certified ||
      query.certificate ||
      query.freshness ||
      query.maxPrice != null ||
      query.maxMoq != null,
  );
}
