import { config } from "dotenv";
import pg from "pg";
import { getPrisma } from "../src/lib/prisma.ts";
import { createSupplier, deleteSupplier, updateSupplier } from "../src/server/supplier-records.ts";
import { getSupplier, scoreSupplier, searchSuppliers } from "../src/server/catalog.ts";
import { parseDiscoveryQuery, toSearchParams } from "../src/lib/discovery-query.ts";
import { normalizeComparableUnit } from "../src/server/matching.ts";
import { comparableOfferGroup } from "../src/server/supplier-search.ts";
import { supplierCompleteness } from "../src/server/supplier-sort.ts";

config();

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const db = new pg.Client({ connectionString });
await db.connect();

const failures = [];

function check(name, condition) {
  if (!condition) failures.push(name);
  else console.log(`ok ${name}`);
}

const counts = await db.query(
  `SELECT "dataType", COUNT(*)::int AS count FROM "Supplier" GROUP BY "dataType" ORDER BY "dataType"`,
);
const byType = Object.fromEntries(counts.rows.map((row) => [row.dataType, row.count]));
check("invalid sort is rejected", parseDiscoveryQuery({ sort: "updatedAt;drop" }).sort === "name");
check("name descending is a supported sort", parseDiscoveryQuery({ sort: "name-desc" }).sort === "name-desc");
const kept = toSearchParams(parseDiscoveryQuery({ sort: "created", category: "dairy", page: "2" }), 2);
check("pagination keeps the sort and filter", kept.get("sort") === "created" && kept.get("category") === "dairy" && kept.get("page") === "2");
check("eight real suppliers", byType.REAL === 8);
check("eighteen demo suppliers", byType.DEMO === 18);

const realGaps = await db.query(
  `SELECT s."slug"
   FROM "Supplier" s
   LEFT JOIN "SupplierProduct" p ON p."supplierId" = s."id"
   WHERE s."dataType" = 'REAL'
   GROUP BY s."id", s."slug"
   HAVING COUNT(p."estimatedPrice") > 0 OR COUNT(p."minimumOrderQuantity") > 0`,
);
check("real prices and MOQ stay null", realGaps.rowCount === 0);

const unsourced = await db.query(
  `SELECT s."slug"
   FROM "Supplier" s
   WHERE s."dataType" = 'REAL'
     AND NOT EXISTS (
       SELECT 1 FROM "SupplierSource" src
       WHERE src."supplierId" = s."id" AND src."url" LIKE 'https://%'
     )`,
);
check("every real supplier has an https source", unsourced.rowCount === 0);

const slugs = await db.query(`SELECT COUNT(DISTINCT "slug")::int AS count, COUNT(*)::int AS rows FROM "Supplier"`);
check("no duplicate slugs", slugs.rows[0].count === slugs.rows[0].rows);

await db.end();

async function names(raw) {
  const first = await searchSuppliers(parseDiscoveryQuery(raw));
  const slugs = first.items.map((item) => item.supplier.slug);
  const prices = first.items.map((item) => item.supplier.minPrice);

  for (let page = 2; page <= first.pages; page += 1) {
    const next = await searchSuppliers(parseDiscoveryQuery({ ...raw, page: String(page) }));
    slugs.push(...next.items.map((item) => item.supplier.slug));
  }

  return { total: first.total, slugs, prices, pageSize: first.items.length };
}

const milk = await names({ q: "МОЛОКО" });
check("МОЛОКО finds EkoNiva", milk.slugs.includes("ekoniva"));
check("МОЛОКО finds demo milk", milk.slugs.includes("nevskaya-molochnaya"));

const milkByName = await names({ q: "МОЛОКО", scope: "name" });
check("name scope keeps a supplier whose name contains молоко", milkByName.slugs.includes("sibirskoe-moloko"));
check("name scope skips a supplier that only matches a product", !milkByName.slugs.includes("ekoniva"));

const milkByProduct = await names({ q: "МОЛОКО", scope: "product" });
check("product scope finds EkoNiva", milkByProduct.slugs.includes("ekoniva"));

const ye = await names({ q: "цыпленка" });
check("е matches ё in цыплёнка", ye.slugs.includes("privolzhskaya-ptica"));

const yo = await names({ q: "ЦЫПЛЁНКА" });
check("ЦЫПЛЁНКА matches the same demo product", yo.slugs.includes("privolzhskaya-ptica"));

const dairy = await names({ category: "dairy" });
check("dairy filter includes EkoNiva", dairy.slugs.includes("ekoniva"));
check("dairy filter excludes a meat supplier", !dairy.slugs.includes("privolzhskaya-ptica"));

const packagingType = await names({ productType: "PACKAGING" });
check("packaging type includes the packaging supplier", packagingType.slugs.includes("upakovka-povolzhyya"));
check("packaging type includes Gotek", packagingType.slugs.includes("gotek"));
check("packaging type excludes a meat supplier", !packagingType.slugs.includes("privolzhskaya-ptica"));
const ingredientsType = await names({ productType: "INGREDIENTS" });
check("ingredients type includes flour supplier", ingredientsType.slugs.includes("centralnaya-bakaleya"));
const finishedType = await names({ productType: "FINISHED_PRODUCTS" });
check("finished products include bottled drinks", finishedType.slugs.includes("stolichnye-napitki"));
const otherType = await names({ productType: "OTHER_FOOD_RELATED_GOODS" });
check("other food goods includes Cherkizovo", otherType.slugs.includes("cherkizovo") && otherType.total === 1);
const packagedDairy = await names({ productType: "PACKAGING", category: "dairy" });
check("product type and category can be combined", packagedDairy.total === 0);
const belaya = await getSupplier("belaya-dacha");
check(
  "category stays beside product type",
  belaya.products.every((product) => product.categorySlug === "produce" && product.productType === "INGREDIENTS"),
);

const city = await names({ city: "Владивосток" });
check("Vladivostok is only Russian Fishery", city.total === 1 && city.slugs[0] === "russian-fishery");

const region = await names({ region: "Белгородская область" });
check("Belgorod region is only EFKO", region.total === 1 && region.slugs[0] === "efko");

const price = await names({ maxPrice: "100" });
check("price filter includes cheap demo milk", price.slugs.includes("nevskaya-molochnaya"));
check("price filter excludes unsourced real prices", !price.slugs.includes("ekoniva") && !price.slugs.includes("miratorg"));

const moq = await names({ maxMoq: "10" });
check("MOQ filter includes a low demo order", moq.slugs.includes("baltiyskiy-ulov") || moq.slugs.includes("moskovskaya-teplitsa"));
check("MOQ filter excludes null real MOQ", !moq.slugs.includes("ekoniva"));

const certified = await names({ certified: "1" });
check("certification filter includes a real sourced claim", certified.slugs.includes("miratorg"));
check("certification filter excludes demonstration certificates", !certified.slugs.includes("privolzhskaya-ptica"));
check(
  "certification filter excludes a supplier with no certificate",
  !certified.slugs.includes("donskaya-govyadina") && !certified.slugs.includes("ekoniva"),
);

const priceSorted = await searchSuppliers(parseDiscoveryQuery({ sort: "price" }));
const priceGroup = await comparableOfferGroup(parseDiscoveryQuery({ sort: "price" }), "price");
const nameOrdered = await searchSuppliers(parseDiscoveryQuery({ sort: "name" }));
check("several equally common foods are not priced as one list", priceGroup == null);
check(
  "incomparable prices stay in company name order",
  priceSorted.items.map((item) => item.supplier.slug).join() ===
    nameOrdered.items.map((item) => item.supplier.slug).join(),
);

const page1 = await searchSuppliers(parseDiscoveryQuery({ sort: "name", page: "1" }));
const page2 = await searchSuppliers(parseDiscoveryQuery({ sort: "name", page: "2" }));
check("page size is 9", page1.items.length === 9 && page1.total === 26);
check(
  "page 2 differs from page 1",
  page2.items.length === 9 &&
    page2.items.every((item) => !page1.items.some((first) => first.supplier.slug === item.supplier.slug)),
);

const dairyName = await searchSuppliers(parseDiscoveryQuery({ category: "dairy" }));
const dairyMatch = await searchSuppliers(parseDiscoveryQuery({ category: "dairy", sort: "match" }));
check("category filter total is unchanged by match sort", dairyName.total === dairyMatch.total && dairyMatch.total > 0);
check(
  "match sort is descending",
  dairyMatch.items.every((item, index, items) => {
    if (index === 0) return true;
    const previous = items[index - 1]?.score;
    if (previous == null) return item.score == null;
    if (item.score == null) return true;
    return item.score <= previous;
  }),
);
check(
  "match rows include a six-part breakdown",
  dairyMatch.items.every((item) => item.report?.factors?.length === 6),
);
const listedTop = (await searchSuppliers(parseDiscoveryQuery({ sort: "match" }))).items[0];
const listedSupplier = await getSupplier(listedTop.supplier.slug);
const profileScore = await scoreSupplier(listedSupplier, parseDiscoveryQuery({}));
const profileFromSort = await scoreSupplier(listedSupplier, parseDiscoveryQuery({ sort: "match" }));
check(
  "profile uses the same catalog score as match sort",
  profileScore?.score != null &&
    profileScore.score === listedTop.score &&
    profileFromSort?.score === listedTop.score,
);
const ekoSupplier = await getSupplier("ekoniva");
const ekoProfile = await scoreSupplier(ekoSupplier, parseDiscoveryQuery({ category: "dairy" }));
const eko = dairyMatch.items.find((item) => item.supplier.slug === "ekoniva");
check("profile keeps the filtered dairy score", ekoProfile?.score === eko?.score && ekoProfile?.score != null);
check(
  "missing prices do not become a perfect score",
  Boolean(eko) &&
    eko.score != null &&
    eko.score < 100 &&
    eko.report.factors.find((factor) => factor.key === "price")?.status === "missing",
);
const matchedPage1 = await searchSuppliers(parseDiscoveryQuery({ sort: "match", page: "1" }));
const matchedPage2 = await searchSuppliers(parseDiscoveryQuery({ sort: "match", page: "2" }));
check(
  "match sort pages do not repeat suppliers",
  matchedPage2.items.length > 0 &&
    matchedPage2.items.every((item) => !matchedPage1.items.some((first) => first.supplier.id === item.supplier.id)),
);
const boundaryScores = [...matchedPage1.items.map((item) => item.score), matchedPage2.items[0]?.score];
check(
  "match sort stays descending across pages",
  boundaryScores.every((score, index) => {
    if (index === 0) return true;
    const previous = boundaryScores[index - 1];
    if (previous == null) return score == null;
    if (score == null) return true;
    return score <= previous;
  }),
);

const created = await createSupplier({
  name: "ДЕМО — Временный поиск",
  slug: "vremennyy-poisk",
  description: "Временная запись для проверки CRUD.",
  supplierType: "OTHER",
  city: "Томск",
  region: "Томская область",
  address: null,
  website: null,
  sourceUrl: "https://example.com/demo/vremennyy-poisk",
  dataType: "DEMO",
  products: [
    {
      name: "Пробный продукт",
      categorySlug: "grocery",
      productType: "INGREDIENTS",
      estimatedPrice: 15,
      minimumOrderQuantity: 3,
      unit: "кг",
      deliveryNotes: null,
    },
  ],
});
const createdSearch = await names({ q: "Временный", city: "Томск" });
check("created supplier is searchable", createdSearch.slugs.includes("vremennyy-poisk"));
const beforeTracking = await names({ q: "Временный", contact: "NOT_CONTACTED" });
check("a supplier with no tracking row counts as not contacted", beforeTracking.slugs.includes("vremennyy-poisk"));
await getPrisma().shortlist.create({
  data: { workspaceKey: "demo-workspace", supplierId: created.id, contactStatus: "NEGOTIATING" },
});
const negotiating = await names({ q: "Временный", contact: "NEGOTIATING" });
const rejected = await names({ q: "Временный", contact: "REJECTED" });
const noLongerNew = await names({ q: "Временный", contact: "NOT_CONTACTED" });
check("contact filter finds the negotiating supplier", negotiating.slugs.includes("vremennyy-poisk"));
check("another status does not include that supplier", !rejected.slugs.includes("vremennyy-poisk"));
check("not contacted no longer includes a tracked supplier", !noLongerNew.slugs.includes("vremennyy-poisk"));

await updateSupplier(created.id, {
  name: "ДЕМО — Временный поиск обновлён",
  slug: "vremennyy-poisk",
  description: "Временная запись для проверки CRUD.",
  supplierType: "OTHER",
  city: "Томск",
  region: "Томская область",
  address: null,
  website: null,
  sourceUrl: "https://example.com/demo/vremennyy-poisk",
  dataType: "DEMO",
  products: [
    {
      name: "Обновлённый продукт",
      categorySlug: "grocery",
      productType: "INGREDIENTS",
      estimatedPrice: 15,
      minimumOrderQuantity: 3,
      unit: "кг",
      deliveryNotes: null,
    },
  ],
});
const updatedSearch = await names({ q: "обновлён" });
check("updated name is searchable", updatedSearch.slugs.includes("vremennyy-poisk"));

await deleteSupplier(created.id);
const deletedSearch = await names({ q: "Временный" });
check("deleted supplier leaves search", !deletedSearch.slugs.includes("vremennyy-poisk"));

async function allSorted(sort, extra = {}) {
  const first = await searchSuppliers(parseDiscoveryQuery({ sort, ...extra }));
  const items = [...first.items];
  for (let page = 2; page <= first.pages; page += 1) {
    const next = await searchSuppliers(parseDiscoveryQuery({ sort, ...extra, page: String(page) }));
    items.push(...next.items);
  }
  return { first, items };
}

function offerAmount(item, group, kind) {
  if (!group) return null;
  const amounts = item.supplier.products.flatMap((product) => {
    const amount = kind === "price" ? product.price : product.moq;
    const sameOffer =
      amount != null &&
      amount >= 0 &&
      product.categorySlug === group.category &&
      normalizeComparableUnit(product.unit) === group.unit &&
      (kind !== "price" || (product.currency || "RUB").toUpperCase() === group.currency);
    return sameOffer ? [amount] : [];
  });
  return amounts.length ? Math.min(...amounts) : null;
}

function monotonic(values, direction) {
  const present = [];
  let seenNull = false;
  for (const value of values) {
    if (value == null) {
      seenNull = true;
      continue;
    }
    if (seenNull) return false;
    present.push(value);
  }
  return present.every((value, index) => {
    if (index === 0) return true;
    return direction === "asc" ? value >= present[index - 1] : value <= present[index - 1];
  });
}

const byName = await allSorted("name");
const byNameDesc = await allSorted("name-desc");
check("name sort stays on its own pages", byName.first.page === 1 && byName.first.items.length === 9);
check(
  "name descending reverses company name order",
  byNameDesc.items.map((item) => item.supplier.slug).join() ===
    byName.items.map((item) => item.supplier.slug).reverse().join(),
);
check(
  "name descending page 2 does not repeat page 1",
  byNameDesc.first.items.every(
    (item) => !byNameDesc.items.slice(9).some((next) => next.supplier.id === item.supplier.id),
  ),
);

const highPrice = await allSorted("price-desc");
const highPriceGroup = await comparableOfferGroup(parseDiscoveryQuery({ sort: "price-desc" }), "price");
check(
  "highest price keeps missing prices last",
  monotonic(highPrice.items.map((item) => offerAmount(item, highPriceGroup, "price")), "desc"),
);
const dairyLow = await allSorted("price", { category: "dairy" });
const dairyHigh = await allSorted("price-desc", { category: "dairy" });
const dairyGroup = await comparableOfferGroup(parseDiscoveryQuery({ sort: "price", category: "dairy" }), "price");
check("dairy price sort stays inside the dairy filter", dairyLow.items.every((item) => item.supplier.products.some((product) => product.categorySlug === "dairy")));
check(
  "dairy lowest and highest price use the same offer and opposite order",
  dairyLow.first.total === dairyHigh.first.total &&
    monotonic(dairyLow.items.map((item) => offerAmount(item, dairyGroup, "price")), "asc") &&
    monotonic(dairyHigh.items.map((item) => offerAmount(item, dairyGroup, "price")), "desc"),
);
check(
  "a dairy supplier without a price is not treated as the cheapest or dearest",
  dairyLow.items.at(-1)?.supplier.slug === "ekoniva" && dairyHigh.items.at(-1)?.supplier.slug === "ekoniva",
);

const openMoqGroup = await comparableOfferGroup(parseDiscoveryQuery({ sort: "moq" }), "moq");
const openMoq = await searchSuppliers(parseDiscoveryQuery({ sort: "moq" }));
const openName = await searchSuppliers(parseDiscoveryQuery({ sort: "name" }));
check("several equally common orders are not compared as one quantity", openMoqGroup == null);
check(
  "incomparable minimum orders stay in company name order",
  openMoq.items.map((item) => item.supplier.slug).join() === openName.items.map((item) => item.supplier.slug).join(),
);
const lowMoq = await allSorted("moq", { category: "dairy" });
const highMoq = await allSorted("moq-desc", { category: "dairy" });
const moqGroup = await comparableOfferGroup(parseDiscoveryQuery({ sort: "moq", category: "dairy" }), "moq");
check("dairy MOQ sort uses kilograms", moqGroup?.category === "dairy" && moqGroup.unit === "kg");
check("lowest MOQ keeps missing quantities last", monotonic(lowMoq.items.map((item) => offerAmount(item, moqGroup, "moq")), "asc"));
check("highest MOQ keeps missing quantities last", monotonic(highMoq.items.map((item) => offerAmount(item, moqGroup, "moq")), "desc"));
const producePrices = await allSorted("price", { category: "produce" });
const produceGroup = await comparableOfferGroup(parseDiscoveryQuery({ sort: "price", category: "produce" }), "price");
check(
  "produce price sort stays in produce kilograms and ignores piece prices",
  produceGroup?.category === "produce" &&
    produceGroup.unit === "kg" &&
    produceGroup.currency === "RUB" &&
    monotonic(producePrices.items.map((item) => offerAmount(item, produceGroup, "price")), "asc") &&
    producePrices.items.every((item) => item.supplier.slug !== "upakovka-povolzhyya"),
);
check(
  "MOQ sort combined with a city filter does not add other cities",
  (await searchSuppliers(parseDiscoveryQuery({ sort: "moq-desc", city: "Владивосток" }))).items.every(
    (item) => item.supplier.city === "Владивосток",
  ),
);

const newest = await allSorted("created");
const createdDates = newest.items.map((item) => item.supplier.createdAt);
check(
  "recently added is newest first",
  createdDates.every((value, index) => index === 0 || value <= createdDates[index - 1]),
);
const updatedIds = (await allSorted("updated")).items.map((item) => item.supplier.id);
const updatedRows = await getPrisma().supplier.findMany({
  where: { id: { in: updatedIds } },
  select: { id: true, updatedAt: true },
});
const updatedAt = new Map(updatedRows.map((row) => [row.id, row.updatedAt.toISOString()]));
const updatedDates = updatedIds.map((id) => updatedAt.get(id));
check(
  "recently updated is latest first and keeps a date for every row",
  updatedDates.every((value) => value) &&
    updatedDates.every((value, index) => index === 0 || value <= updatedDates[index - 1]),
);

const complete = await allSorted("complete");
const completeScores = complete.items.map((item) => supplierCompleteness(item.supplier));
check(
  "most complete information is descending",
  completeScores.every((value, index) => index === 0 || value <= completeScores[index - 1]),
);
check(
  "equal completeness keeps company name order",
  complete.items.every((item, index, items) => {
    if (index === 0 || supplierCompleteness(item.supplier) !== supplierCompleteness(items[index - 1].supplier)) return true;
    return item.supplier.name.localeCompare(items[index - 1].supplier.name, "ru") >= 0;
  }),
);

const invalidSorted = await searchSuppliers(parseDiscoveryQuery({ sort: "Supplier.updatedAt", category: "dairy" }));
const dairyNamed = await searchSuppliers(parseDiscoveryQuery({ category: "dairy" }));
check(
  "an unknown sort with a category filter uses company name order",
  invalidSorted.total === dairyNamed.total &&
    invalidSorted.items.map((item) => item.supplier.slug).join() === dairyNamed.items.map((item) => item.supplier.slug).join(),
);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("search and filter checks passed");
