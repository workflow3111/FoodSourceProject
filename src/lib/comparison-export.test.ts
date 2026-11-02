import assert from "node:assert/strict";
import type { ContactStatus } from "./contact-tracking";
import {
  buildComparisonCsv,
  comparisonExportColumns,
  type ComparisonExportLabels,
} from "./comparison-export";
import type { CatalogSupplier, WorkspaceEntry } from "@/server/catalog-types";

const missing = "Not available";
const labels: ComparisonExportLabels = {
  columns: {
    name: "Supplier name",
    type: "Supplier type",
    categories: "Product categories",
    products: "Products",
    productTypes: "Product types",
    city: "City",
    region: "Region",
    country: "Country",
    website: "Website",
    contactPerson: "Contact person",
    email: "Email",
    phone: "Phone",
    price: "Price",
    currency: "Currency",
    priceUnit: "Price unit",
    moq: "Minimum order quantity",
    certifications: "Certifications",
    deliveryRegions: "Delivery regions",
    deliveryTerms: "Delivery terms",
    score: "Matching score",
    contactStatus: "Contact status",
    freshness: "Data freshness status",
    updated: "Last updated date",
    sourceUrl: "Source URL",
  },
  missing,
  supplierType: {
    MANUFACTURER: "Manufacturer",
    DISTRIBUTOR: "Distributor",
    FARM: "Farm",
    IMPORTER: "Importer",
    PACKAGING: "Packaging",
    WHOLESALER: "Wholesaler",
    OTHER: "Other",
  },
  productType: {
    INGREDIENTS: "Ingredients",
    FINISHED_PRODUCTS: "Finished products",
    PACKAGING: "Packaging",
    OTHER_FOOD_RELATED_GOODS: "Other food-related goods",
  },
  contactStatus: {
    NOT_CONTACTED: "Not contacted",
    CONTACTED: "Contacted",
    AWAITING_RESPONSE: "Awaiting response",
    RESPONDED: "Responded",
    NEGOTIATING: "Negotiating",
    QUALIFIED: "Qualified",
    REJECTED: "Rejected",
  },
  freshness: {
    fresh: "Fresh",
    aging: "Aging",
    stale: "Stale",
    unknown: "Unknown",
  },
};

const now = new Date("2026-11-01T12:00:00.000Z");

function supplier(patch: Partial<CatalogSupplier> & Pick<CatalogSupplier, "id" | "name">): CatalogSupplier {
  return {
    slug: patch.id,
    description: null,
    supplierType: "MANUFACTURER",
    city: null,
    region: null,
    country: "Россия",
    address: null,
    website: null,
    sourceUrl: null,
    logoUrl: null,
    dataType: "DEMO",
    verificationStatus: "UNVERIFIED",
    lastVerifiedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
    products: [],
    contacts: [],
    certifications: [],
    sources: [],
    minPrice: null,
    minMoq: null,
    ...patch,
  };
}

function product(name: string, price: number | null, unit: string, moq: number | null = null): CatalogSupplier["products"][number] {
  return {
    id: name,
    name,
    categorySlug: unit === "pcs" ? "packaging" : "dairy",
    categoryNameRu: unit === "pcs" ? "Упаковка" : "Молоко",
    categoryNameEn: unit === "pcs" ? "Packaging" : "Dairy",
    price,
    currency: "RUB",
    productType: unit === "pcs" ? "PACKAGING" : "INGREDIENTS",
    moq,
    unit,
    deliveryNotes: null,
    imageUrl: null,
    dataType: "DEMO",
    priceUpdatedAt: null,
  };
}

const dairy = supplier({
  id: "dairy",
  name: 'ООО "Молоко", Казань',
  city: "Казань",
  region: "Татарстан",
  website: "https://example.com/milk",
  sourceUrl: "https://example.com/source",
  products: [
    { ...product("Молоко", 100, "kg", 10), deliveryNotes: "Поставка в Казань\nпо согласованию" },
    product("Стакан", 1, "pcs", 5),
  ],
  contacts: [
    { id: "mail", type: "EMAIL", label: null, value: "sales@example.com" },
    { id: "phone", type: "PHONE", label: null, value: "+7 (000) 100-00-01" },
    { id: "site", type: "WEBSITE", label: null, value: "https://example.com/form" },
  ],
  certifications: [
    {
      id: "cert",
      name: "ISO, \"demo\"",
      certificateNumber: null,
      documentUrl: null,
      sourceUrl: null,
      issuer: null,
      recordedStatus: "UNKNOWN",
      certificateStatus: "UNKNOWN",
      verificationStatus: "UNVERIFIED",
      verifiedAt: null,
      verifiedBy: null,
      verificationNotes: null,
      issuedAt: null,
      expiresAt: null,
      isDemo: true,
    },
  ],
});

const peer = supplier({
  id: "peer",
  name: "=1+1",
  supplierType: "FARM",
  city: "Москва",
  products: [product("Кефир", 80, "kg", 4)],
  updatedAt: null,
});

const extra = supplier({ id: "extra", name: "Лишний", products: [product("Ряженка", 90, "kg")] });
const fourth = supplier({ id: "fourth", name: "Четвёртый", products: [product("Сыр", 70, "kg")] });

const workspace: WorkspaceEntry[] = [
  {
    supplierId: "dairy",
    contactStatus: "NEGOTIATING" satisfies ContactStatus,
    lastContactOn: null,
    nextFollowUpOn: null,
    contactPerson: "Иванова",
    contactMethod: null,
    updatedAt: "2026-10-31T00:00:00.000Z",
    notes: [{ id: "note", supplierId: "dairy", content: "secret-note-should-not-export", updatedAt: "2026-10-31T00:00:00.000Z" }],
  },
];

const csv = buildComparisonCsv({
  suppliers: [dairy, peer, extra, fourth],
  workspace,
  locale: "ru",
  labels,
  now,
  timeZone: "UTC",
});
const rows = parseCsv(csv);

assert.equal(rows[0]?.length, comparisonExportColumns.length);
assert.deepEqual(rows[0], Object.values(labels.columns));
assert.equal(rows.length, 4);
assert.equal(rows.some((row) => row[0] === "Четвёртый"), false);
assert.equal(csv.includes("secret-note-should-not-export"), false);
assert.equal(csv.includes("https://example.com/form"), false);

const milk = rowMap(rows[1]);
assert.equal(milk.name, 'ООО "Молоко", Казань');
assert.equal(milk.type, "Manufacturer");
assert.equal(milk.categories, "Молоко; Упаковка");
assert.equal(milk.products, "Молоко; Стакан");
assert.equal(milk.city, "Казань");
assert.equal(milk.region, "Татарстан");
assert.equal(milk.country, "Россия");
assert.equal(milk.website, "https://example.com/milk");
assert.equal(milk.contactPerson, "Иванова");
assert.equal(milk.email, "sales@example.com");
assert.equal(milk.phone, "'+7 (000) 100-00-01");
assert.equal(milk.price, "100");
assert.equal(milk.currency, "RUB");
assert.equal(milk.priceUnit, "kg");
assert.equal(milk.moq, "10 kg");
assert.equal(milk.certifications, 'ISO, "demo"');
assert.equal(milk.deliveryRegions, missing);
assert.equal(milk.deliveryTerms, "Поставка в Казань\nпо согласованию");
assert.notEqual(milk.score, missing);
assert.equal(milk.contactStatus, "Negotiating");
assert.equal(milk.freshness, "Fresh");
assert.equal(milk.updated, "2026-10-20");
assert.equal(milk.sourceUrl, "https://example.com/source");

const formula = rowMap(rows[2]);
assert.equal(formula.name, "'=1+1");
assert.equal(formula.city, "Москва");
assert.equal(formula.price, "80");
assert.equal(formula.contactPerson, missing);
assert.equal(formula.contactStatus, missing);
assert.equal(formula.email, missing);
assert.equal(formula.freshness, "Unknown");
assert.equal(formula.updated, missing);
assert.equal(formula.certifications, missing);

const blank = buildComparisonCsv({
  suppliers: [supplier({ id: "blank", name: "Пусто" })],
  workspace: [],
  locale: "en",
  labels,
  now,
  timeZone: "UTC",
});
const emptyRow = rowMap(parseCsv(blank)[1]);
assert.equal(emptyRow.products, missing);
assert.equal(emptyRow.price, missing);
assert.equal(emptyRow.currency, missing);
assert.equal(emptyRow.priceUnit, missing);
assert.equal(emptyRow.moq, missing);
assert.equal(emptyRow.website, missing);

assert.equal(parseCsv(buildComparisonCsv({
  suppliers: [],
  workspace: [],
  locale: "en",
  labels,
  now,
  timeZone: "UTC",
})).length, 1);

function rowMap(row: string[] | undefined) {
  assert.ok(row);
  return Object.fromEntries(comparisonExportColumns.map((column, index) => [column, row[index]])) as Record<
    (typeof comparisonExportColumns)[number],
    string
  >;
}

function parseCsv(text: string) {
  assert.equal(text.charCodeAt(0), 0xfeff);
  const source = text.slice(1).replace(/\r\n$/, "");
  const parsed: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r" && source[index + 1] === "\n") {
      row.push(field);
      parsed.push(row);
      row = [];
      field = "";
      index += 1;
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    parsed.push(row);
  }
  return parsed;
}

console.log("comparison export checks passed");
