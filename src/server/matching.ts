import { isConfirmedCertificate } from "@/lib/certificate-status";

export const defaultMatchWeights = {
  product: 0.35,
  geography: 0.25,
  price: 0.15,
  moq: 0.1,
  certification: 0.1,
  delivery: 0.05,
} as const;

export type MatchWeightKey = keyof typeof defaultMatchWeights;

export type MatchWeights = Record<MatchWeightKey, number>;

export type MatchContext = {
  query?: string;
  category?: string;
  city?: string;
  region?: string;
  /** Highest acceptable unit price. Values at or below it can be scored without a peer group. */
  maxPrice?: number | null;
  /** Highest acceptable minimum order. Values at or below it can be scored without a peer group. */
  maxMoq?: number | null;
  /**
   * Search filter for real certification records.
   * It does not award points to an unverified certificate.
   */
  certified?: boolean;
  weights?: Partial<MatchWeights>;
};

export type MatchProduct = {
  name: string;
  categorySlug: string;
  categoryNameRu: string;
  categoryNameEn: string;
  price: number | null;
  currency: string;
  moq: number | null;
  unit: string | null;
  deliveryNotes: string | null;
};

export type MatchCertification = {
  /** Effective validity, already resolved from the expiration date. */
  certificateStatus: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "SUSPENDED" | "REVOKED" | "UNKNOWN";
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
};

export type MatchSupplier = {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  dataType: "REAL" | "DEMO";
  verificationStatus: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | "EXPIRED";
  products: MatchProduct[];
  certifications: MatchCertification[];
};

export type PriceCohortGroup = {
  unit: string | null;
  currency: string;
  suppliers: number;
  min: number;
  max: number;
};

export type QuantityCohortGroup = {
  unit: string | null;
  suppliers: number;
  min: number;
  max: number;
};

export type MatchCohort = {
  prices?: PriceCohortGroup[];
  moqs?: QuantityCohortGroup[];
};

export type FactorStatus = "scored" | "missing" | "not_comparable" | "not_requested";

export type MatchReason =
  | "category_match"
  | "category_miss"
  | "product_text"
  | "name_only"
  | "no_product_match"
  | "shared_category"
  | "different_categories"
  | "no_shared_category"
  | "location_match"
  | "partial_location"
  | "location_miss"
  | "location_text"
  | "location_unavailable"
  | "no_location_requested"
  | "lower_is_better"
  | "within_limit"
  | "above_limit"
  | "price_unavailable"
  | "moq_unavailable"
  | "different_unit"
  | "no_peer_value"
  | "verified"
  | "unverified_not_counted"
  | "expired_not_verified"
  | "suspended_not_current"
  | "revoked_not_current"
  | "rejected_not_counted"
  | "no_certification_records"
  | "demonstration_not_evidence"
  | "stated_for_requested_place_unverified"
  | "stated_but_place_not_mentioned"
  | "delivery_not_stated"
  | "delivery_not_requested";

export type MatchFactor = {
  key: MatchWeightKey;
  weight: number;
  status: FactorStatus;
  /** 0–1 when this factor is scored. Null when it is excluded. */
  ratio: number | null;
  /** Points toward the displayed 0–100 score. Null when this factor is excluded. */
  points: number | null;
  reason: MatchReason;
};

export type OfferComparison = {
  amount: number | null;
  unit: string | null;
  currency: string | null;
  lowest: boolean;
  missing: boolean;
  mixedUnits: boolean;
};

export type MatchGrade = "exact" | "partial" | "mismatch" | "unavailable" | "not_requested";

export type MatchQuality = "strong" | "partial" | "weak" | "unavailable";

export type MatchReport = {
  supplierId: string;
  /**
   * 0–100. Earned points divided by the weight of applicable criteria.
   * Null when nothing applicable was scored.
   * Missing facts stay in that denominator, so they do not raise the score.
   */
  score: number | null;
  /** Share of applicable weight that was scored, from 0 to 1. */
  coverage: number;
  factors: MatchFactor[];
  price: OfferComparison;
  moq: OfferComparison;
  verifiedCertifications: number;
  unverifiedCertifications: number;
  deliveryStated: boolean;
  /** Always false: a stated delivery area is not a verified service promise. */
  deliveryVerified: boolean;
  countsAsVerifiedSupplier: boolean;
  /** Always true: the highest score does not mean this is the best supplier. */
  doesNotGuaranteeBestSupplier: boolean;
};

const weightKeys = Object.keys(defaultMatchWeights) as MatchWeightKey[];

export function resolveMatchWeights(override?: Partial<MatchWeights>): MatchWeights {
  const merged = { ...defaultMatchWeights, ...override };
  for (const key of weightKeys) {
    const value = merged[key];
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Match weights must be non-negative finite numbers.");
    }
  }
  const sum = weightKeys.reduce((total, key) => total + merged[key], 0);
  if (sum === 0) {
    throw new Error("Match weights must not all be zero.");
  }
  return {
    product: merged.product / sum,
    geography: merged.geography / sum,
    price: merged.price / sum,
    moq: merged.moq / sum,
    certification: merged.certification / sum,
    delivery: merged.delivery / sum,
  };
}

export function matchSuppliers(
  suppliers: MatchSupplier[],
  context: MatchContext = {},
  cohort?: MatchCohort,
): MatchReport[] {
  const weights = resolveMatchWeights(context.weights);
  const priceGroup = chooseGroup(cohort?.prices ?? priceGroups(suppliers), weights.price);
  const moqGroup = chooseGroup(cohort?.moqs ?? moqGroups(suppliers), weights.moq);
  const sharedCategories = sharedCategorySlugs(suppliers);
  const drafts = suppliers.map((supplier) => {
    const factors = [
      productFactor(supplier, context, sharedCategories, weights.product),
      geographyFactor(supplier, context, weights.geography),
      numericFactor("price", supplier, context, priceGroup, weights.price, "price_unavailable"),
      numericFactor("moq", supplier, context, moqGroup, weights.moq, "moq_unavailable"),
      certificationFactor(supplier, context, weights.certification),
      deliveryFactor(supplier, context, weights.delivery),
    ];
    const { score, coverage, factors: withPoints } = summarize(factors);
    return { supplier, factors: withPoints, score, coverage };
  });

  return drafts.map(({ supplier, factors, score, coverage }) => {
    const price = offerComparison(supplier, priceGroup, "price");
    const moq = offerComparison(supplier, moqGroup, "moq");
    const verifiedCertifications =
      supplier.dataType === "DEMO" ? 0 : supplier.certifications.filter((item) => isConfirmedCertificate(item)).length;
    return {
      supplierId: supplier.id,
      score,
      coverage,
      factors,
      price: { ...price, lowest: false },
      moq: { ...moq, lowest: false },
      verifiedCertifications,
      unverifiedCertifications: supplier.certifications.length - (supplier.dataType === "DEMO" ? 0 : verifiedCertifications),
      deliveryStated: supplier.products.some((product) => Boolean(product.deliveryNotes)),
      deliveryVerified: false as const,
      countsAsVerifiedSupplier: supplier.dataType === "REAL" && supplier.verificationStatus === "VERIFIED",
      doesNotGuaranteeBestSupplier: true,
    };
  }).map((report, _, reports) => ({
    ...report,
    price: { ...report.price, lowest: isLowest(report.price, reports.map((item) => item.price)) },
    moq: { ...report.moq, lowest: isLowest(report.moq, reports.map((item) => item.moq)) },
  }));
}

function productFactor(
  supplier: MatchSupplier,
  context: MatchContext,
  sharedCategories: Set<string>,
  weight: number,
): MatchFactor {
  if (context.category) {
    const hit = supplier.products.some((product) => product.categorySlug === context.category);
    return factor("product", weight, "scored", hit ? 1 : 0, hit ? "category_match" : "category_miss");
  }

  const needle = fold(context.query ?? "");
  if (needle) {
    const productHit = supplier.products.some((product) =>
      fold([product.name, product.categoryNameRu, product.categoryNameEn].join(" ")).includes(needle),
    );
    if (productHit) return factor("product", weight, "scored", 1, "product_text");
    if (fold(supplier.name).includes(needle)) return factor("product", weight, "scored", 0.55, "name_only");
    return factor("product", weight, "scored", 0, "no_product_match");
  }

  if (sharedCategories.size === 0) {
    return factor("product", weight, "not_comparable", null, "no_shared_category");
  }
  const hit = supplier.products.some((product) => sharedCategories.has(product.categorySlug));
  return factor("product", weight, "scored", hit ? 1 : 0, hit ? "shared_category" : "different_categories");
}

function geographyFactor(supplier: MatchSupplier, context: MatchContext, weight: number): MatchFactor {
  const city = fold(supplier.city ?? "");
  const region = fold(supplier.region ?? "");
  if (context.city || context.region) {
    const cityRequested = Boolean(context.city);
    const regionRequested = Boolean(context.region);
    const cityOk = cityRequested && city === fold(context.city ?? "");
    const regionOk = regionRequested && region === fold(context.region ?? "");
    if (cityRequested && !city && regionRequested && regionOk) {
      return factor("geography", weight, "scored", 0.6, "partial_location");
    }
    if ((cityRequested && !city) || (regionRequested && !region)) {
      return factor("geography", weight, "missing", null, "location_unavailable");
    }
    if (cityRequested && regionRequested) {
      if (cityOk && regionOk) return factor("geography", weight, "scored", 1, "location_match");
      if (cityOk || regionOk) return factor("geography", weight, "scored", 0.6, "partial_location");
      return factor("geography", weight, "scored", 0, "location_miss");
    }
    if (cityRequested) return factor("geography", weight, "scored", cityOk ? 1 : 0, cityOk ? "location_match" : "location_miss");
    return factor("geography", weight, "scored", regionOk ? 1 : 0, regionOk ? "location_match" : "location_miss");
  }

  const needle = fold(context.query ?? "");
  if (needle && ((city && city.includes(needle)) || (region && region.includes(needle)))) {
    return factor("geography", weight, "scored", 1, "location_text");
  }
  return factor("geography", weight, "not_requested", null, "no_location_requested");
}

function certificationFactor(supplier: MatchSupplier, _context: MatchContext, weight: number): MatchFactor {
  if (supplier.dataType === "DEMO") {
    return factor("certification", weight, "missing", null, "demonstration_not_evidence");
  }
  if (supplier.certifications.length === 0) {
    return factor("certification", weight, "missing", null, "no_certification_records");
  }
  if (supplier.certifications.some((item) => isConfirmedCertificate(item))) {
    return factor("certification", weight, "scored", 1, "verified");
  }
  const failed = supplier.certifications.filter((item) => knownCertificateFailure(item));
  if (failed.length === 0) {
    return factor("certification", weight, "missing", null, "unverified_not_counted");
  }
  return factor("certification", weight, "scored", 0, certificateFailureReason(failed));
}

function knownCertificateFailure(certificate: MatchCertification) {
  return (
    certificate.verificationStatus === "REJECTED" ||
    certificate.certificateStatus === "EXPIRED" ||
    certificate.certificateStatus === "SUSPENDED" ||
    certificate.certificateStatus === "REVOKED"
  );
}

function certificateFailureReason(certificates: MatchCertification[]): MatchReason {
  if (certificates.some((item) => item.verificationStatus === "REJECTED")) return "rejected_not_counted";
  if (certificates.some((item) => item.certificateStatus === "REVOKED")) return "revoked_not_current";
  if (certificates.some((item) => item.certificateStatus === "SUSPENDED")) return "suspended_not_current";
  return "expired_not_verified";
}

function deliveryFactor(supplier: MatchSupplier, context: MatchContext, weight: number): MatchFactor {
  const notes = supplier.products.flatMap((product) => (product.deliveryNotes ? [product.deliveryNotes] : []));
  if (notes.length === 0) return factor("delivery", weight, "missing", null, "delivery_not_stated");

  const places = [context.city, context.region].filter((value): value is string => Boolean(value));
  if (places.length === 0) return factor("delivery", weight, "not_requested", null, "delivery_not_requested");

  const haystack = fold(notes.join(" "));
  const mentioned = places.some((place) => haystack.includes(fold(place)));
  return factor(
    "delivery",
    weight,
    "scored",
    mentioned ? 1 : 0,
    mentioned ? "stated_for_requested_place_unverified" : "stated_but_place_not_mentioned",
  );
}

type NumericGroup = { unit: string | null; currency: string | null; supplierIds: Set<string>; min: number; max: number };

function numericFactor(
  key: "price" | "moq",
  supplier: MatchSupplier,
  context: MatchContext,
  group: NumericGroup | null,
  weight: number,
  missingReason: "price_unavailable" | "moq_unavailable",
): MatchFactor {
  const offers = key === "price" ? pricedOffers(supplier) : moqOffers(supplier);
  const ceiling = key === "price" ? context.maxPrice : context.maxMoq;
  if (!group) {
    return unmatchedNumeric(key, weight, offers, ceiling, missingReason);
  }
  const own = offers.filter((offer) => offer.unit === group.unit && (key !== "price" || offer.currency === group.currency));
  if (own.length === 0) {
    return unmatchedNumeric(key, weight, offers, ceiling, missingReason, true);
  }
  const amount = Math.min(...own.map((offer) => offer.amount));
  const limit = limitScore(amount, ceiling);
  if (limit?.reason === "above_limit") return factor(key, weight, "scored", 0, "above_limit");
  return factor(key, weight, "scored", lowerIsBetter(amount, group.min, group.max), "lower_is_better");
}

function unmatchedNumeric(
  key: "price" | "moq",
  weight: number,
  offers: Array<{ unit: string | null; amount: number }>,
  ceiling: number | null | undefined,
  missingReason: "price_unavailable" | "moq_unavailable",
  unitMismatch = false,
): MatchFactor {
  if (offers.length === 0) return factor(key, weight, "missing", null, missingReason);
  const units = new Set(offers.map((offer) => offer.unit));
  if (units.size !== 1 || unitMismatch) {
    return factor(key, weight, "not_comparable", null, unitMismatch ? "different_unit" : "no_peer_value");
  }
  const limit = limitScore(Math.min(...offers.map((offer) => offer.amount)), ceiling);
  if (!limit) return factor(key, weight, "not_comparable", null, "no_peer_value");
  return factor(key, weight, "scored", limit.ratio, limit.reason);
}

function limitScore(amount: number, ceiling: number | null | undefined) {
  if (ceiling == null || !Number.isFinite(ceiling) || ceiling <= 0 || !Number.isFinite(amount)) return null;
  if (amount > ceiling) return { ratio: 0, reason: "above_limit" as const };
  return { ratio: 0.5 + 0.5 * (1 - amount / ceiling), reason: "within_limit" as const };
}

function offerComparison(supplier: MatchSupplier, group: NumericGroup | null, key: "price" | "moq"): OfferComparison {
  const offers = key === "price" ? pricedOffers(supplier) : moqOffers(supplier);
  const own = group
    ? offers.filter((offer) => offer.unit === group.unit && (key !== "price" || offer.currency === group.currency))
    : [];
  if (own.length > 0 && group) {
    return {
      amount: Math.min(...own.map((offer) => offer.amount)),
      unit: group.unit,
      currency: key === "price" ? group.currency : null,
      lowest: false,
      missing: false,
      mixedUnits: false,
    };
  }
  const display = offers.reduce<(typeof offers)[number] | null>((lowest, offer) => {
    if (!lowest || offer.amount < lowest.amount) return offer;
    return lowest;
  }, null);
  return {
    amount: display?.amount ?? null,
    unit: display?.unit ?? null,
    currency: key === "price" ? display?.currency ?? null : null,
    lowest: false,
    missing: display == null,
    mixedUnits: display != null,
  };
}

function summarize(factors: MatchFactor[]) {
  const applicable = factors.filter((factor) => factor.status !== "not_requested" && factor.weight > 0);
  const applicableWeight = applicable.reduce((total, factor) => total + factor.weight, 0);
  const scored = applicable.filter((factor) => factor.status === "scored" && factor.ratio != null);
  const earned = scored.reduce((total, factor) => total + (factor.ratio ?? 0) * factor.weight, 0);
  if (applicableWeight === 0 || scored.length === 0) {
    return { score: null, coverage: 0, factors: factors.map((item) => ({ ...item, points: null })) };
  }
  const score = Math.round((earned / applicableWeight) * 100);
  const coverage = scored.reduce((total, factor) => total + factor.weight, 0) / applicableWeight;
  return { score, coverage, factors: assignPoints(factors, score, applicableWeight) };
}

function assignPoints(factors: MatchFactor[], score: number | null, weightSum: number) {
  if (score == null || weightSum === 0) {
    return factors.map((item) => ({ ...item, points: null }));
  }
  const exact = factors.map((item) =>
    item.status === "scored" && item.ratio != null && item.weight > 0
      ? ((item.ratio * item.weight) / weightSum) * 100
      : null,
  );
  const floors = exact.map((value) => (value == null ? null : Math.floor(value)));
  let remainder = score - floors.reduce<number>((total, value) => total + (value ?? 0), 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value == null ? -1 : value - Math.floor(value) }))
    .filter((item) => item.fraction >= 0)
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  let cursor = 0;
  while (remainder > 0 && order.length > 0 && cursor < 100) {
    const item = order[cursor % order.length];
    const current = floors[item.index];
    if (current != null) {
      floors[item.index] = current + 1;
      remainder -= 1;
    }
    cursor += 1;
  }
  return factors.map((item, index) => ({ ...item, points: floors[index] }));
}

export function cohortFromProductRows(
  rows: Array<{ supplierId: string; unit: string | null; currency: string | null; price: number | null; moq: number | null }>,
): MatchCohort {
  return {
    prices: groupsFromOffers(
      rows.flatMap((row) =>
        row.price == null || !Number.isFinite(row.price) || row.price < 0
          ? []
          : [{ supplierId: row.supplierId, unit: normalizeUnit(row.unit), currency: row.currency || "RUB", amount: row.price }],
      ),
    ),
    moqs: groupsFromOffers(
      rows.flatMap((row) =>
        row.moq == null || !Number.isFinite(row.moq) || row.moq < 0
          ? []
          : [{ supplierId: row.supplierId, unit: normalizeUnit(row.unit), currency: null, amount: row.moq }],
      ),
    ),
  };
}

export function sqlUnitKey(columnSql: string) {
  const normalized = `translate(lower(replace(replace(coalesce(${columnSql}, ''), ' ', ''), '.', '')), 'ё', 'е')`;
  const whens = Object.entries(unitAliases)
    .map(([from, to]) => `WHEN '${from.replaceAll("'", "''")}' THEN '${to}'`)
    .join(" ");
  return `CASE ${normalized} ${whens} ELSE ${normalized} END`;
}

function isLowest(offer: OfferComparison, offers: OfferComparison[]) {
  if (offer.missing || offer.mixedUnits || offer.amount == null) return false;
  const comparable = offers.filter((item) => !item.missing && !item.mixedUnits && item.amount != null);
  if (comparable.length < 2) return false;
  const lowest = Math.min(...comparable.map((item) => item.amount ?? 0));
  return offer.amount === lowest && comparable.some((item) => (item.amount ?? 0) > lowest);
}

function chooseGroup(
  groups: Array<{ unit: string | null; currency?: string; suppliers: number; min: number; max: number }>,
  weight: number,
): NumericGroup | null {
  if (weight === 0) return null;
  const merged = new Map<string, NumericGroup & { suppliers: number }>();
  for (const group of groups) {
    if (group.suppliers < 1 || !Number.isFinite(group.min) || !Number.isFinite(group.max)) continue;
    const unit = normalizeUnit(group.unit);
    const currency = group.currency ?? null;
    const key = `${currency ?? ""}:${unit ?? ""}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { unit, currency, supplierIds: new Set(), suppliers: group.suppliers, min: group.min, max: group.max });
      continue;
    }
    current.suppliers += group.suppliers;
    current.min = Math.min(current.min, group.min);
    current.max = Math.max(current.max, group.max);
  }
  const eligible = [...merged.values()].filter((group) => group.suppliers >= 2);
  if (eligible.length === 0) return null;
  eligible.sort((left, right) => right.suppliers - left.suppliers || right.max - right.min - (left.max - left.min));
  const [best, next] = eligible;
  if (next && next.suppliers === best.suppliers) return null;
  return { unit: best.unit, currency: best.currency, supplierIds: new Set(Array.from({ length: best.suppliers }, (_, index) => String(index))), min: best.min, max: best.max };
}

function priceGroups(suppliers: MatchSupplier[]) {
  return groupsFromOffers(suppliers.flatMap((supplier) => pricedOffers(supplier).map((offer) => ({ ...offer, supplierId: supplier.id }))));
}

function moqGroups(suppliers: MatchSupplier[]) {
  return groupsFromOffers(suppliers.flatMap((supplier) => moqOffers(supplier).map((offer) => ({ ...offer, supplierId: supplier.id }))));
}

function groupsFromOffers(offers: Array<{ supplierId: string; unit: string | null; currency: string | null; amount: number }>) {
  const grouped = new Map<string, { unit: string | null; currency: string; suppliers: Set<string>; min: number; max: number }>();
  for (const offer of offers) {
    const key = `${offer.currency ?? ""}:${offer.unit ?? ""}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { unit: offer.unit, currency: offer.currency ?? "", suppliers: new Set([offer.supplierId]), min: offer.amount, max: offer.amount });
      continue;
    }
    current.suppliers.add(offer.supplierId);
    current.min = Math.min(current.min, offer.amount);
    current.max = Math.max(current.max, offer.amount);
  }
  return [...grouped.values()].map((group) => ({
    unit: group.unit,
    currency: group.currency,
    suppliers: group.suppliers.size,
    min: group.min,
    max: group.max,
  }));
}

function pricedOffers(supplier: MatchSupplier) {
  return supplier.products.flatMap((product) =>
    usableAmount(product.price)
      ? [{ unit: normalizeUnit(product.unit), currency: product.currency || "RUB", amount: product.price }]
      : [],
  );
}

function moqOffers(supplier: MatchSupplier) {
  return supplier.products.flatMap((product) =>
    usableAmount(product.moq) ? [{ unit: normalizeUnit(product.unit), currency: null, amount: product.moq }] : [],
  );
}

function usableAmount(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function sharedCategorySlugs(suppliers: MatchSupplier[]) {
  const counts = new Map<string, number>();
  for (const supplier of suppliers) {
    for (const slug of new Set(supplier.products.map((product) => product.categorySlug))) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return new Set([...counts.entries()].filter(([, count]) => count >= 2).map(([slug]) => slug));
}

function lowerIsBetter(value: number, min: number, max: number) {
  if (max === min) return 1;
  return Math.min(1, Math.max(0, 1 - (value - min) / (max - min)));
}

function factor(
  key: MatchWeightKey,
  weight: number,
  status: FactorStatus,
  ratio: number | null,
  reason: MatchReason,
): MatchFactor {
  return { key, weight, status, ratio, points: null, reason };
}

function fold(value: string) {
  return value.toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/[%_\\]/g, "");
}

export const unitAliases: Record<string, string> = {
  кг: "kg",
  kg: "kg",
  килограмм: "kg",
  л: "l",
  литр: "l",
  литра: "l",
  шт: "pcs",
  штука: "pcs",
  штук: "pcs",
  упак: "pack",
  упаковка: "pack",
};

export function normalizeComparableUnit(unit: string | null) {
  return normalizeUnit(unit);
}

export function factorGrade(factor: MatchFactor): MatchGrade {
  if (factor.status === "not_requested") return "not_requested";
  if (factor.status !== "scored" || factor.ratio == null) return "unavailable";
  if (factor.ratio >= 1) return "exact";
  if (factor.ratio <= 0) return "mismatch";
  return "partial";
}

export function matchQuality(report: Pick<MatchReport, "score" | "coverage">): MatchQuality {
  if (report.score == null) return "unavailable";
  if (report.score >= 75 && report.coverage >= 0.6) return "strong";
  if (report.score >= 45) return "partial";
  return "weak";
}

export function leadingReason(report: MatchReport): MatchReason | null {
  const scored = report.factors.filter((factor) => factor.status === "scored" && factor.ratio != null && factor.weight > 0);
  if (scored.length === 0) return null;
  scored.sort((left, right) => (right.ratio ?? 0) - (left.ratio ?? 0) || right.weight - left.weight);
  return scored[0]?.reason ?? null;
}

function normalizeUnit(unit: string | null) {
  if (unit == null || unit.trim() === "") return null;
  const folded = fold(unit).replace(/\./g, "").replace(/\s+/g, "");
  return unitAliases[folded] ?? folded;
}
