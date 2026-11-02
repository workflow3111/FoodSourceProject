import assert from "node:assert/strict";
import {
  cohortFromProductRows,
  defaultMatchWeights,
  factorGrade,
  leadingReason,
  matchQuality,
  matchSuppliers,
  resolveMatchWeights,
  type MatchCertification,
  type MatchSupplier,
} from "./matching";

const weights = Object.values(defaultMatchWeights);
assert.equal(Number(weights.reduce((sum, value) => sum + value, 0).toFixed(10)), 1);
assert.deepEqual(defaultMatchWeights, {
  product: 0.35,
  geography: 0.25,
  price: 0.15,
  moq: 0.1,
  certification: 0.1,
  delivery: 0.05,
});

assert.throws(() => resolveMatchWeights({ product: -1 }), /non-negative/);
assert.throws(
  () =>
    resolveMatchWeights({
      product: 0,
      geography: 0,
      price: 0,
      moq: 0,
      certification: 0,
      delivery: 0,
    }),
  /zero/,
);

const productOnly = resolveMatchWeights({ product: 70, geography: 0, price: 0, moq: 0, certification: 0, delivery: 0 });
assert.equal(productOnly.product, 1);

function cert(
  certificateStatus: MatchCertification["certificateStatus"],
  verificationStatus: MatchCertification["verificationStatus"] = "UNVERIFIED",
): MatchCertification {
  return { certificateStatus, verificationStatus };
}

function supplier(patch: Partial<MatchSupplier> & Pick<MatchSupplier, "id" | "name">): MatchSupplier {
  return {
    city: null,
    region: null,
    dataType: "REAL",
    verificationStatus: "UNVERIFIED",
    products: [],
    certifications: [],
    ...patch,
  };
}

function product(patch: Partial<MatchSupplier["products"][number]> & Pick<MatchSupplier["products"][number], "name">) {
  return {
    categorySlug: "grocery",
    categoryNameRu: "Бакалея",
    categoryNameEn: "Grocery",
    price: null,
    currency: "RUB",
    moq: null,
    unit: null,
    deliveryNotes: null,
    ...patch,
  };
}

const dairy = supplier({
  id: "dairy",
  name: "ЭкоНива",
  city: "Москва",
  products: [product({ name: "Молоко", categorySlug: "dairy", categoryNameRu: "Молочная продукция", categoryNameEn: "Dairy" })],
});
const poultry = supplier({
  id: "poultry",
  name: "Приволжская птица",
  city: "Казань",
  region: "Республика Татарстан",
  dataType: "DEMO",
  products: [
    product({
      name: "Тушка цыплёнка-бройлера",
      categorySlug: "meat",
      categoryNameRu: "Мясо",
      categoryNameEn: "Meat",
      price: 246,
      moq: 100,
      unit: "кг",
      deliveryNotes: "Демо: доставка по региону",
    }),
  ],
  certifications: [cert("UNKNOWN")],
});

const [found] = matchSuppliers([dairy], { query: "МОЛОКО", category: "dairy", city: "Москва" });
assert.equal(found.factors.find((factor) => factor.key === "product")?.reason, "category_match");
assert.equal(found.factors.find((factor) => factor.key === "geography")?.reason, "location_match");
assert.equal(found.factors.find((factor) => factor.key === "price")?.status, "missing");
assert.equal(found.factors.find((factor) => factor.key === "price")?.points, null);
assert.equal(found.doesNotGuaranteeBestSupplier, true);
assert.equal(found.countsAsVerifiedSupplier, false);

const [yeMatch] = matchSuppliers([poultry], { query: "цыпленка" });
assert.equal(yeMatch.factors.find((factor) => factor.key === "product")?.reason, "product_text");
assert.equal(yeMatch.factors.find((factor) => factor.key === "certification")?.reason, "demonstration_not_evidence");
assert.notEqual(yeMatch.factors.find((factor) => factor.key === "certification")?.reason, "verified");

const pricedKg = supplier({
  id: "kg-low",
  name: "Низкая цена",
  products: [product({ name: "Рис", price: 90, moq: 50, unit: "кг" })],
});
const pricedKgHigh = supplier({
  id: "kg-high",
  name: "Высокая цена",
  products: [product({ name: "Рис", price: 180, moq: 20, unit: "kg" })],
});
const pricedPieces = supplier({
  id: "pieces",
  name: "Штуки",
  products: [product({ name: "Контейнер", price: 6.5, moq: 10, unit: "шт" })],
});

const sameUnit = matchSuppliers([pricedKg, pricedKgHigh]);
assert.equal(sameUnit[0].price.lowest, true);
assert.equal(sameUnit[1].price.lowest, false);
assert.equal(sameUnit[0].price.mixedUnits, false);
assert.equal(sameUnit[0].moq.lowest, false);
assert.equal(sameUnit[1].moq.lowest, true);
assert.ok((sameUnit[0].factors.find((factor) => factor.key === "price")?.ratio ?? 0) > (sameUnit[1].factors.find((factor) => factor.key === "price")?.ratio ?? 0));

const mixed = matchSuppliers([pricedKg, pricedPieces]);
assert.equal(mixed[0].price.lowest, false);
assert.equal(mixed[1].price.lowest, false);
assert.equal(mixed[0].price.mixedUnits, true);
assert.equal(mixed[1].price.mixedUnits, true);
assert.equal(mixed[0].price.amount, 90);
assert.equal(mixed[0].price.unit, "kg");
assert.equal(mixed[1].price.amount, 6.5);
assert.equal(mixed[1].price.unit, "pcs");
assert.equal(mixed[0].moq.amount, 50);
assert.equal(mixed[1].moq.amount, 10);
assert.equal(mixed[0].moq.lowest, false);
assert.equal(mixed[1].moq.lowest, false);
assert.equal(mixed[0].factors.find((factor) => factor.key === "price")?.status, "not_comparable");
assert.equal(mixed[1].factors.find((factor) => factor.key === "moq")?.status, "not_comparable");

const withOutlier = matchSuppliers([pricedKg, pricedKgHigh, pricedPieces]);
assert.equal(withOutlier[2].price.amount, 6.5);
assert.equal(withOutlier[2].price.mixedUnits, true);
assert.equal(withOutlier[2].price.lowest, false);
assert.equal(withOutlier[0].price.mixedUnits, false);

for (const report of sameUnit) {
  const points = report.factors.reduce((total, factor) => total + (factor.points ?? 0), 0);
  assert.equal(points, report.score);
  assert.ok(report.factors.every((factor) => factor.points == null || Number.isInteger(factor.points)));
}

const [wrongCity] = matchSuppliers([poultry], { city: "Москва" });
assert.equal(wrongCity.factors.find((factor) => factor.key === "geography")?.reason, "location_miss");
assert.equal(wrongCity.factors.find((factor) => factor.key === "geography")?.ratio, 0);

const [partialLocation] = matchSuppliers([poultry], { city: "Москва", region: "Республика Татарстан" });
assert.equal(partialLocation.factors.find((factor) => factor.key === "geography")?.reason, "partial_location");

const aliasCohort = cohortFromProductRows([
  { supplierId: "a", unit: "кг", currency: "RUB", price: 10, moq: 1 },
  { supplierId: "a", unit: "kg", currency: "RUB", price: 12, moq: 2 },
  { supplierId: "b", unit: "kg", currency: "RUB", price: 20, moq: 3 },
]);
const aliasPrices = aliasCohort.prices ?? [];
const aliasPrice = aliasPrices[0];
assert.equal(aliasPrices.length, 1);
assert.equal(aliasPrice?.unit, "kg");
assert.equal(aliasPrice?.suppliers, 2);

const knownUnverified = supplier({
  id: "claimed",
  name: "Заявлено",
  dataType: "REAL",
  products: [product({ name: "Масло", categorySlug: "grocery" })],
  certifications: [cert("UNKNOWN")],
});
const unknownCerts = supplier({
  id: "unknown",
  name: "Без записей",
  dataType: "REAL",
  products: [product({ name: "Масло", categorySlug: "grocery" })],
});
const verified = supplier({
  id: "verified",
  name: "Проверено",
  dataType: "REAL",
  verificationStatus: "VERIFIED",
  products: [product({ name: "Масло", categorySlug: "grocery" })],
  certifications: [cert("VALID", "VERIFIED")],
});
const expired = supplier({
  id: "expired",
  name: "Истекло",
  dataType: "REAL",
  products: [product({ name: "Масло", categorySlug: "grocery" })],
  certifications: [cert("EXPIRED", "VERIFIED")],
});
const certReports = matchSuppliers([knownUnverified, unknownCerts, verified, expired], { category: "grocery" });
assert.equal(certReports[0].factors.find((factor) => factor.key === "certification")?.reason, "unverified_not_counted");
assert.equal(certReports[0].factors.find((factor) => factor.key === "certification")?.status, "missing");
assert.equal(certReports[0].factors.find((factor) => factor.key === "certification")?.ratio, null);
assert.equal(certReports[0].verifiedCertifications, 0);
assert.equal(certReports[1].factors.find((factor) => factor.key === "certification")?.status, "missing");
assert.equal(certReports[1].factors.find((factor) => factor.key === "certification")?.points, null);
assert.equal(factorGrade(certReports[1].factors.find((factor) => factor.key === "certification")!), "unavailable");
assert.equal(factorGrade(certReports[0].factors.find((factor) => factor.key === "certification")!), "unavailable");
assert.equal(certReports[2].factors.find((factor) => factor.key === "certification")?.reason, "verified");
assert.equal(certReports[2].verifiedCertifications, 1);
assert.equal(certReports[2].countsAsVerifiedSupplier, true);
assert.equal(certReports[3].factors.find((factor) => factor.key === "certification")?.reason, "expired_not_verified");
assert.equal(factorGrade(certReports[3].factors.find((factor) => factor.key === "certification")!), "mismatch");
assert.equal(certReports[1].score, certReports[0].score);
assert.ok((certReports[2].score ?? 0) > (certReports[0].score ?? 0));

const [preferredCert] = matchSuppliers([knownUnverified], { category: "grocery", certified: true });
assert.equal(preferredCert.factors.find((factor) => factor.key === "certification")?.reason, "unverified_not_counted");
assert.equal(factorGrade(preferredCert.factors.find((factor) => factor.key === "certification")!), "unavailable");

const statusCases = [
  [cert("VALID", "UNVERIFIED"), "unverified_not_counted", "missing"],
  [cert("VALID", "PENDING"), "unverified_not_counted", "missing"],
  [cert("UNKNOWN", "VERIFIED"), "unverified_not_counted", "missing"],
  [cert("EXPIRING_SOON", "VERIFIED"), "verified", "scored"],
  [cert("SUSPENDED", "VERIFIED"), "suspended_not_current", "scored"],
  [cert("REVOKED", "UNVERIFIED"), "revoked_not_current", "scored"],
  [cert("VALID", "REJECTED"), "rejected_not_counted", "scored"],
] as const;
for (const [entry, reason, status] of statusCases) {
  const [report] = matchSuppliers([
    supplier({
      id: reason,
      name: reason,
      dataType: "REAL",
      products: [product({ name: "Масло", categorySlug: "grocery" })],
      certifications: [entry],
    }),
  ], { category: "grocery" });
  assert.equal(report.factors.find((factor) => factor.key === "certification")?.reason, reason);
  assert.equal(report.factors.find((factor) => factor.key === "certification")?.status, status);
}
const [demoVerified] = matchSuppliers([
  supplier({
    id: "demo-verified",
    name: "Демо проверка",
    dataType: "DEMO",
    products: [product({ name: "Масло", categorySlug: "grocery" })],
    certifications: [cert("VALID", "VERIFIED")],
  }),
], { category: "grocery" });
assert.equal(demoVerified.factors.find((factor) => factor.key === "certification")?.reason, "demonstration_not_evidence");
assert.equal(demoVerified.verifiedCertifications, 0);

const stated = supplier({
  id: "stated",
  name: "Доставка",
  city: "Казань",
  products: [product({ name: "Салат", deliveryNotes: "Поставка в Казань и Москву" })],
});
const [delivery] = matchSuppliers([stated], { city: "Казань" });
const deliveryFactor = delivery.factors.find((factor) => factor.key === "delivery");
assert.equal(deliveryFactor?.reason, "stated_for_requested_place_unverified");
assert.equal(delivery.deliveryVerified, false);

const [unasked] = matchSuppliers([stated]);
assert.equal(unasked.factors.find((factor) => factor.key === "delivery")?.status, "not_requested");
assert.equal(unasked.factors.find((factor) => factor.key === "delivery")?.points, null);

const meat = supplier({
  id: "meat",
  name: "Мясо",
  products: [product({ name: "Говядина", categorySlug: "meat" })],
});
const alsoMeat = supplier({
  id: "also-meat",
  name: "Ещё мясо",
  products: [product({ name: "Свинина", categorySlug: "meat" })],
});
const packaging = supplier({
  id: "pack",
  name: "Упаковка",
  products: [product({ name: "Короб", categorySlug: "packaging" })],
});
const compatibility = matchSuppliers([meat, alsoMeat, packaging]);
assert.equal(compatibility[0].factors.find((factor) => factor.key === "product")?.reason, "shared_category");
assert.equal(compatibility[2].factors.find((factor) => factor.key === "product")?.reason, "different_categories");

const [weighted] = matchSuppliers([pricedKg, pricedKgHigh], {
  weights: { product: 0, geography: 0, price: 1, moq: 0, certification: 0, delivery: 0 },
});
assert.equal(weighted.score, 100);
assert.equal(weighted.factors.find((factor) => factor.key === "price")?.weight, 1);

const [missingOnly] = matchSuppliers([
  supplier({
    id: "empty",
    name: "Пусто",
    products: [product({ name: "Без чисел", categorySlug: "grocery" })],
  }),
], { category: "grocery" });
assert.equal(missingOnly.score, 47);
assert.equal(Number(missingOnly.coverage.toFixed(2)), 0.47);
assert.notEqual(missingOnly.score, 100);
assert.equal(matchQuality(missingOnly), "partial");
assert.equal(leadingReason(missingOnly), "category_match");
assert.equal(factorGrade(missingOnly.factors.find((factor) => factor.key === "product")!), "exact");
assert.equal(factorGrade(missingOnly.factors.find((factor) => factor.key === "price")!), "unavailable");
assert.ok(missingOnly.factors.filter((factor) => factor.key !== "product").every((factor) => factor.points == null));

const conflict = matchSuppliers(
  [
    supplier({
      id: "fit",
      name: "Совпадает",
      city: "Казань",
      region: "Республика Татарстан",
      products: [product({ name: "Молоко", categorySlug: "dairy", price: 80, moq: 10, unit: "кг" })],
      certifications: [cert("VALID", "VERIFIED")],
    }),
    supplier({
      id: "split",
      name: "Частично",
      city: "Москва",
      products: [product({ name: "Кефир", categorySlug: "dairy", price: 120, moq: 40, unit: "kg" })],
    }),
  ],
  { category: "dairy", city: "Казань" },
);
assert.equal(factorGrade(conflict[0].factors.find((factor) => factor.key === "product")!), "exact");
assert.equal(factorGrade(conflict[0].factors.find((factor) => factor.key === "geography")!), "exact");
assert.equal(conflict[1].factors.find((factor) => factor.key === "product")?.reason, "category_match");
assert.equal(conflict[1].factors.find((factor) => factor.key === "geography")?.reason, "location_miss");
assert.equal(factorGrade(conflict[1].factors.find((factor) => factor.key === "geography")!), "mismatch");
assert.ok((conflict[0].score ?? 0) > (conflict[1].score ?? 0));
assert.ok((conflict[0].score ?? 100) < 100);

const invalidPrice = supplier({
  id: "invalid",
  name: "Неверная цена",
  products: [product({ name: "Рис", price: -5, moq: Number.NaN, unit: "кг" })],
});
const [invalid] = matchSuppliers([invalidPrice, pricedKg], { maxPrice: 100, maxMoq: 80 });
assert.equal(invalid.factors.find((factor) => factor.key === "price")?.status, "missing");
assert.equal(invalid.factors.find((factor) => factor.key === "moq")?.status, "missing");
assert.notEqual(invalid.factors.find((factor) => factor.key === "price")?.reason, "lower_is_better");

const [underCeiling] = matchSuppliers(
  [supplier({ id: "under", name: "В пределе", products: [product({ name: "Рис", price: 40, moq: 10, unit: "кг" })] })],
  { maxPrice: 80, maxMoq: 20 },
);
assert.equal(underCeiling.factors.find((factor) => factor.key === "price")?.reason, "within_limit");
assert.equal(factorGrade(underCeiling.factors.find((factor) => factor.key === "price")!), "partial");
assert.equal(underCeiling.factors.find((factor) => factor.key === "moq")?.reason, "within_limit");

const [overCeiling] = matchSuppliers(
  [supplier({ id: "over", name: "Выше предела", products: [product({ name: "Рис", price: 90, unit: "кг" })] })],
  { maxPrice: 80 },
);
assert.equal(overCeiling.factors.find((factor) => factor.key === "price")?.reason, "above_limit");
assert.equal(overCeiling.factors.find((factor) => factor.key === "price")?.ratio, 0);

const dirtyCohort = cohortFromProductRows([
  { supplierId: "a", unit: "кг", currency: "RUB", price: -1, moq: Number.POSITIVE_INFINITY },
  { supplierId: "b", unit: "kg", currency: "RUB", price: 10, moq: 2 },
]);
assert.equal(dirtyCohort.prices?.length, 1);
assert.equal(dirtyCohort.moqs?.length, 1);

console.log("matching checks passed");
