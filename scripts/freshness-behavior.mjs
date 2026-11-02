import { config } from "dotenv";
import { parseDiscoveryQuery } from "../src/lib/discovery-query.ts";
import {
  calendarDateInZone,
  freshnessStatuses,
  freshnessStatus,
  serverTimeZone,
} from "../src/lib/freshness.ts";
import { getPrisma } from "../src/lib/prisma.ts";
import { getSupplier, searchSuppliers } from "../src/server/catalog.ts";
import { createSupplier, deleteSupplier } from "../src/server/supplier-records.ts";

config();

const failures = [];
const zone = serverTimeZone();
const now = new Date();

function check(name, condition) {
  if (!condition) failures.push(name);
  else console.log(`ok ${name}`);
}

function dayOffset(day, days) {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + days));
  return shifted.toISOString().slice(0, 10);
}

function instantOn(day) {
  let cursor = new Date(`${day}T00:00:00.000Z`);
  for (let hour = 0; hour < 48; hour += 1) {
    if (calendarDateInZone(cursor, zone) === day) return cursor;
    cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
  }
  throw new Error(`No instant for ${day} in ${zone}`);
}

async function collect(raw) {
  const first = await searchSuppliers(parseDiscoveryQuery(raw));
  const items = [...first.items];
  for (let page = 2; page <= first.pages; page += 1) {
    const next = await searchSuppliers(parseDiscoveryQuery({ ...raw, page: String(page) }));
    items.push(...next.items);
  }
  return { total: first.total, items };
}

const catalog = await collect({});
const expected = { fresh: 0, aging: 0, stale: 0, unknown: 0 };
for (const item of catalog.items) {
  expected[freshnessStatus(item.supplier.updatedAt, now, zone)] += 1;
}
check("catalog rows have a record timestamp", catalog.items.every((item) => item.supplier.updatedAt));
for (const status of freshnessStatuses) {
  const filtered = await searchSuppliers(parseDiscoveryQuery({ freshness: status }));
  check(`${status} filter matches the record-update classification`, filtered.total === expected[status]);
}
const ignored = await searchSuppliers(parseDiscoveryQuery({ freshness: "updatedAt;drop" }));
check("invalid freshness parameter is ignored", ignored.total === catalog.total);

const slug = "svezhest-proverka";
let created = null;
try {
  created = await createSupplier({
    name: "ДЕМО — Проверка свежести",
    slug,
    description: "Временная запись для проверки свежести.",
    supplierType: "OTHER",
    city: "Томск",
    region: "Томская область",
    address: null,
    website: null,
    sourceUrl: "https://example.com/demo/svezhest-proverka",
    dataType: "DEMO",
    products: [
      {
        name: "Пробный продукт",
        categorySlug: "grocery",
        productType: "INGREDIENTS",
        estimatedPrice: null,
        minimumOrderQuantity: null,
        unit: null,
        deliveryNotes: null,
      },
    ],
  });

  const today = calendarDateInZone(now, zone);
  const cases = [
    ["fresh", dayOffset(today, -10)],
    ["aging", dayOffset(today, -45)],
    ["stale", dayOffset(today, -120)],
    ["unknown", dayOffset(today, 3)],
  ];
  const oldSourceCheck = instantOn(dayOffset(today, -400));

  for (const [status, day] of cases) {
    const updatedAt = instantOn(day);
    await getPrisma().$executeRaw`UPDATE "Supplier" SET "updatedAt" = ${updatedAt} WHERE "id" = ${created.id}::uuid`;
    await getPrisma().$executeRaw`
      UPDATE "SupplierSource"
      SET "checkedAt" = ${oldSourceCheck}
      WHERE "supplierId" = ${created.id}::uuid
    `;
    const stored = await getSupplier(slug);
    check(`${status} keeps verification unchanged`, stored?.verificationStatus === "UNVERIFIED" && stored.lastVerifiedAt == null);
    check(`${status} keeps the stored source`, stored?.sourceUrl === "https://example.com/demo/svezhest-proverka");
    check(
      `${status} does not use the source check as the record update`,
      freshnessStatus(stored?.updatedAt, now, zone) === status &&
        freshnessStatus(stored?.sources[0]?.checkedAt, now, zone) === "stale",
    );
    const matched = await searchSuppliers(parseDiscoveryQuery({ freshness: status, q: "Проверка свежести" }));
    const other = freshnessStatuses.find((item) => item !== status);
    const excluded = await searchSuppliers(parseDiscoveryQuery({ freshness: other, q: "Проверка свежести" }));
    check(`${status} filter includes that record update`, matched.items.some((item) => item.supplier.slug === slug));
    check(`${status} filter excludes a different category`, !excluded.items.some((item) => item.supplier.slug === slug));
  }

  await getPrisma().$executeRaw`
    UPDATE "Supplier" SET "updatedAt" = ${instantOn(dayOffset(today, -120))} WHERE "id" = ${created.id}::uuid
  `;
  const withCity = await searchSuppliers(parseDiscoveryQuery({ freshness: "stale", city: "Томск", q: "Проверка свежести" }));
  const otherCity = await searchSuppliers(parseDiscoveryQuery({ freshness: "stale", city: "Москва", q: "Проверка свежести" }));
  check("freshness filter keeps the city filter", withCity.items.some((item) => item.supplier.slug === slug));
  check("freshness filter does not add another city", !otherCity.items.some((item) => item.supplier.slug === slug));
} finally {
  if (created) await deleteSupplier(created.id);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("freshness catalog checks passed");
