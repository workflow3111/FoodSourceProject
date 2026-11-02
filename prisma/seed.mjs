import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";
import ts from "typescript";
import { realSuppliers } from "./real-suppliers.mjs";

config();

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const queryTimeoutMs = 15_000;
const lockTimeoutMs = 10_000;

function stamp() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`${stamp()} ${message}`);
}

function describeError(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
  const code = error && typeof error === "object" && "code" in error && error.code ? String(error.code) : "none";
  return { message, code };
}

let currentOperation = "startup";

function reportFailure(operation, error) {
  const { message, code } = describeError(error);
  console.error(`${stamp()} failed ${operation}: ${message} (PostgreSQL code ${code})`);
}

log("start load seed modules");
const typeSource = readFileSync(new URL("../src/lib/product-type.ts", import.meta.url), "utf8");
const typeCompiled = ts.transpileModule(typeSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const source = readFileSync(new URL("./seed.ts", import.meta.url), "utf8");
const start = source.indexOf("const categories");
const end = source.indexOf("function idFor");
const slice = source.slice(start, end);
const compiled = ts.transpileModule(`${slice}\nmodule.exports = { categories, suppliers };`, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

mkdirSync(new URL("../.cache/", import.meta.url), { recursive: true });
writeFileSync(new URL("../.cache/demo-data.cjs", import.meta.url), compiled);
writeFileSync(new URL("../.cache/product-type.cjs", import.meta.url), typeCompiled);

const require = createRequire(import.meta.url);
const { categories, suppliers } = require("../.cache/demo-data.cjs");
const { productTypeForName } = require("../.cache/product-type.cjs");
log(`done load seed modules (${categories.length} categories, ${suppliers.length} demonstration suppliers, ${realSuppliers.length} real suppliers)`);

function idFor(key) {
  const hex = createHash("sha256").update(key).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const demoDescription =
  "Демонстрационная карточка. Название, цены, минимальный заказ, контакты и сертификаты вымышлены и не являются коммерческим предложением или проверенным источником.";

const client = new pg.Client({
  connectionString,
  statement_timeout: queryTimeoutMs,
  lock_timeout: lockTimeoutMs,
  query_timeout: queryTimeoutMs,
});

async function step(operation, sql, params) {
  currentOperation = operation;
  log(`start ${operation}`);
  const started = Date.now();
  try {
    const result = await client.query(sql, params);
    log(`done ${operation} (${Date.now() - started}ms)`);
    return result;
  } catch (error) {
    reportFailure(operation, error);
    if (error && typeof error === "object") error.seedLogged = true;
    throw error;
  }
}

let transactionOpen = false;

try {
  currentOperation = "PostgreSQL connection";
  log("start PostgreSQL connection");
  const connectedAt = Date.now();
  await client.connect();
  log(`done PostgreSQL connection (${Date.now() - connectedAt}ms)`);

  await step("set statement_timeout", "SET statement_timeout = 15000");
  await step("set lock_timeout", "SET lock_timeout = 10000");
  await step("BEGIN transaction", "BEGIN");
  transactionOpen = true;

  const categoryIds = new Map();
  for (const category of categories) {
    const inserted = await step(
      `category upsert: ${category.slug}`,
      `INSERT INTO "Category" ("id", "nameRu", "nameEn", "slug", "sortOrder", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT ("slug") DO UPDATE SET
         "nameRu" = EXCLUDED."nameRu",
         "nameEn" = EXCLUDED."nameEn",
         "sortOrder" = EXCLUDED."sortOrder",
         "updatedAt" = NOW()
       RETURNING "id"`,
      [idFor(`category:${category.slug}`), category.nameRu, category.nameEn, category.slug, category.sortOrder],
    );
    categoryIds.set(category.slug, inserted.rows[0].id);
  }

  const supplierTotal = suppliers.length + realSuppliers.length;
  let supplierNumber = 0;

  for (const [index, supplier] of suppliers.entries()) {
    const createdAt = new Date(Date.UTC(2026, 8, 1) + index * 36 * 60 * 60 * 1000);
    const url = `https://example.com/demo/${supplier.slug}`;
    await upsertSupplier(client, {
      slug: supplier.slug,
      name: supplier.name,
      description: demoDescription,
      type: supplier.type,
      city: supplier.city,
      region: supplier.region,
      address: `Демонстрационный адрес, ${supplier.city}`,
      website: url,
      sourceUrl: url,
      dataType: "DEMO",
      verificationStatus: "UNVERIFIED",
      lastVerifiedAt: null,
      createdAt,
      products: supplier.products.map((product) => ({
        category: product.category,
        name: product.name,
        description: null,
        price: product.price,
        moq: product.moq,
        unit: product.unit,
        delivery: product.delivery,
        image: product.image,
        dataType: "DEMO",
        productType: productTypeForName(product.name),
      })),
      contacts: [
        ["PHONE", "Демо-телефон", `+7 (000) 100-${String(index + 1).padStart(2, "0")}-01`, null],
        ["EMAIL", "Демо-почта", `demo+${supplier.slug}@example.com`, null],
        ["WEBSITE", "Демо-сайт", url, null],
      ],
      certs: supplier.certs.map((cert) => ({
        name: cert.name,
        certificateStatus: cert.certificateStatus,
        issuer: "Демонстрационный орган",
        sourceUrl: null,
        notes: "Запись вымышлена. Документ не проверялся и не подтверждает соответствие.",
        expiresInDays: cert.expiresInDays,
      })),
      sources: [
        {
          type: "DEMO",
          url,
          title: "Демонстрационная карточка",
          evidence: "Fabricated sample. This URL is a placeholder, not a citation of a real company.",
          isPrimary: true,
          checkedAt: createdAt,
        },
      ],
    }, categoryIds, ++supplierNumber, supplierTotal);
  }

  for (const supplier of realSuppliers) {
    await upsertSupplier(client, {
      slug: supplier.slug,
      name: supplier.name,
      description: supplier.description,
      type: supplier.type,
      city: supplier.city,
      region: supplier.region,
      address: supplier.address,
      website: supplier.website,
      sourceUrl: supplier.sourceUrl,
      dataType: "REAL",
      verificationStatus: "PARTIALLY_VERIFIED",
      lastVerifiedAt: supplier.checkedAt,
      createdAt: supplier.checkedAt,
      products: supplier.products.map((product) => ({
        category: product.category,
        name: product.name,
        description: product.description ?? null,
        price: null,
        moq: null,
        unit: null,
        delivery: supplier.deliveryNotes ?? null,
        dataType: "REAL",
        productType: productTypeForName(product.name),
      })),
      contacts: supplier.contacts.map((contact) => [contact.type, contact.label, contact.value, contact.sourceUrl]),
      certs: supplier.certs,
      sources: supplier.sources.map((source) => ({
        type: "OFFICIAL_WEBSITE",
        url: source.url,
        title: source.title,
        evidence: source.evidence,
        isPrimary: source.isPrimary,
        checkedAt: supplier.checkedAt,
      })),
    }, categoryIds, ++supplierNumber, supplierTotal);
  }

  const demoSlugs = suppliers.map((supplier) => supplier.slug);
  await step(
    "demo supplier cleanup",
    `DELETE FROM "Supplier" WHERE "dataType" = 'DEMO' AND NOT ("slug" = ANY($1::text[]))`,
    [demoSlugs],
  );

  await step("COMMIT transaction", "COMMIT");
  transactionOpen = false;
  log(`Seeded ${realSuppliers.length} real and ${suppliers.length} demonstration suppliers.`);
} catch (error) {
  if (!error || typeof error !== "object" || !error.seedLogged) reportFailure(currentOperation, error);
  if (transactionOpen) {
    try {
      log("start ROLLBACK transaction");
      await client.query("ROLLBACK");
      log("done ROLLBACK transaction");
    } catch (rollbackError) {
      reportFailure("ROLLBACK transaction", rollbackError);
    }
  }
  process.exitCode = 1;
} finally {
  log("start database connection closing");
  try {
    await client.end();
    log("done database connection closing");
  } catch (error) {
    reportFailure("database connection closing", error);
    process.exitCode = 1;
  }
}

async function upsertSupplier(db, supplier, categoryIds, supplierNumber, supplierTotal) {
  log(`Processing supplier ${supplierNumber}/${supplierTotal}: ${supplier.slug}`);
  const saved = await step(
    `supplier upsert: ${supplier.slug}`,
    `INSERT INTO "Supplier"
      ("id", "name", "slug", "description", "supplierType", "city", "region", "country", "address", "website", "sourceUrl", "dataType", "verificationStatus", "lastVerifiedAt", "logoUrl", "isActive", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Россия',$8,$9,$10,$11,$12,$13,$14,true,$15,NOW())
     ON CONFLICT ("slug") DO UPDATE SET
       "name" = EXCLUDED."name",
       "description" = EXCLUDED."description",
       "supplierType" = EXCLUDED."supplierType",
       "city" = EXCLUDED."city",
       "region" = EXCLUDED."region",
       "country" = EXCLUDED."country",
       "address" = EXCLUDED."address",
       "website" = EXCLUDED."website",
       "sourceUrl" = EXCLUDED."sourceUrl",
       "dataType" = EXCLUDED."dataType",
       "verificationStatus" = EXCLUDED."verificationStatus",
       "lastVerifiedAt" = EXCLUDED."lastVerifiedAt",
       "logoUrl" = EXCLUDED."logoUrl",
       "isActive" = true,
       "updatedAt" = NOW()
     RETURNING "id"`,
    [
      idFor(`supplier:${supplier.slug}`),
      supplier.name,
      supplier.slug,
      supplier.description,
      supplier.type,
      supplier.city,
      supplier.region,
      supplier.address,
      supplier.website,
      supplier.sourceUrl,
      supplier.dataType,
      supplier.verificationStatus,
      supplier.lastVerifiedAt,
      supplier.dataType === "DEMO" ? `/images/suppliers/${supplier.slug}.jpg` : null,
      supplier.createdAt,
    ],
  );
  const supplierId = saved.rows[0].id;

  await step(`supplier product deletion: ${supplier.slug}`, `DELETE FROM "SupplierProduct" WHERE "supplierId" = $1`, [supplierId]);
  await step(`supplier contact deletion: ${supplier.slug}`, `DELETE FROM "SupplierContact" WHERE "supplierId" = $1`, [supplierId]);
  await step(`certification deletion: ${supplier.slug}`, `DELETE FROM "Certification" WHERE "supplierId" = $1`, [supplierId]);
  await step(`supplier source deletion: ${supplier.slug}`, `DELETE FROM "SupplierSource" WHERE "supplierId" = $1`, [supplierId]);

  for (const product of supplier.products) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`Unknown category ${product.category} for ${supplier.slug}`);
    await step(
      `supplier product insertion: ${supplier.slug} / ${product.name}`,
      `INSERT INTO "SupplierProduct"
        ("id", "supplierId", "categoryId", "name", "description", "estimatedPrice", "currency", "minimumOrderQuantity", "unit", "deliveryNotes", "imageUrl", "isAvailable", "productType", "dataType", "priceUpdatedAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,'RUB',$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
      [
        idFor(`product:${supplier.slug}:${product.name}`),
        supplierId,
        categoryId,
        product.name,
        product.description,
        product.price,
        product.moq,
        product.unit,
        product.delivery,
        product.image ?? null,
        supplier.dataType === "DEMO" ? true : null,
        product.productType,
        product.dataType,
        product.price == null ? null : supplier.createdAt,
      ],
    );
  }

  for (const [type, label, value, sourceUrl] of supplier.contacts) {
    await step(
      `supplier contact insertion: ${supplier.slug} / ${type}`,
      `INSERT INTO "SupplierContact" ("id", "supplierId", "type", "label", "value", "isPublic", "sourceUrl")
       VALUES ($1,$2,$3,$4,$5,true,$6)`,
      [idFor(`contact:${supplier.slug}:${type}:${value}`), supplierId, type, label, value, sourceUrl],
    );
  }

  for (const cert of supplier.certs) {
    const expiresAt =
      typeof cert.expiresInDays === "number" ? new Date(Date.now() + cert.expiresInDays * 86_400_000) : null;
    await step(
      `certification insertion: ${supplier.slug} / ${cert.name}`,
      `INSERT INTO "Certification"
        ("id", "supplierId", "name", "certificateStatus", "verificationStatus", "issuer", "verificationNotes", "sourceUrl", "expiresAt", "isDemo", "updatedAt")
       VALUES ($1,$2,$3,$4,'UNVERIFIED',$5,$6,$7,$8,$9,NOW())`,
      [
        idFor(`cert:${supplier.slug}:${cert.name}`),
        supplierId,
        cert.name,
        cert.certificateStatus ?? (cert.status === "EXPIRED" ? "EXPIRED" : "UNKNOWN"),
        cert.issuer,
        cert.notes,
        cert.sourceUrl,
        expiresAt,
        supplier.dataType === "DEMO",
      ],
    );
  }

  for (const source of supplier.sources) {
    await step(
      `supplier source insertion: ${supplier.slug} / ${source.type}`,
      `INSERT INTO "SupplierSource"
        ("id", "supplierId", "sourceType", "url", "title", "evidence", "isPrimary", "checkedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        idFor(`source:${supplier.slug}:${source.url}`),
        supplierId,
        source.type,
        source.url,
        source.title,
        source.evidence,
        source.isPrimary,
        source.checkedAt,
      ],
    );
  }
}
