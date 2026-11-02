import { formatMoney, formatQuantity } from "@/lib/format";
import type { CatalogProduct, CatalogSupplier } from "@/server/catalog-types";
import { normalizeComparableUnit } from "@/server/matching";

export type OfferLine =
  | { kind: "missing" }
  | { kind: "single"; text: string }
  | { kind: "mixed"; text: string };

type Offer = { amount: number; currency: string; rawUnit: string | null; normalized: string | null };

export function priceLine(supplier: CatalogSupplier, locale: string, from: (value: string) => string): OfferLine {
  return offerLine(
    supplier.products.flatMap((product) =>
      product.price == null ? [] : [offer(product, product.price)],
    ),
    locale,
    from,
    "price",
  );
}

export function moqLine(supplier: CatalogSupplier, locale: string, from: (value: string) => string): OfferLine {
  return offerLine(
    supplier.products.flatMap((product) => (product.moq == null ? [] : [offer(product, product.moq)])),
    locale,
    from,
    "moq",
  );
}

export function placeLine(supplier: Pick<CatalogSupplier, "city" | "region">) {
  return [supplier.city, supplier.region].filter(Boolean).join(", ");
}

function offer(product: CatalogProduct, amount: number): Offer {
  return {
    amount,
    currency: product.currency,
    rawUnit: product.unit,
    normalized: normalizeComparableUnit(product.unit),
  };
}

function offerLine(offers: Offer[], locale: string, from: (value: string) => string, kind: "price" | "moq"): OfferLine {
  if (offers.length === 0) return { kind: "missing" };
  const groups = new Map<string, Offer[]>();
  for (const item of offers) {
    const key = `${item.currency}:${item.normalized ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const parts = [...groups.values()].map((group) => {
    const lowest = Math.min(...group.map((item) => item.amount));
    const sample = group.find((item) => item.amount === lowest) ?? group[0];
    if (!sample) return "";
    const rawUnits = new Set(group.map((item) => item.rawUnit ?? ""));
    const unit =
      locale.startsWith("en") && sample.normalized
        ? sample.normalized
        : rawUnits.size === 1
          ? sample.rawUnit
          : sample.normalized;
    return formatOffer(kind, lowest, unit, sample.currency, locale);
  });
  const text = parts.filter(Boolean).join(" · ");
  if (groups.size === 1) return { kind: "single", text: from(text) };
  return { kind: "mixed", text };
}

function formatOffer(kind: "price" | "moq", amount: number, unit: string | null, currency: string, locale: string) {
  if (kind === "moq") return formatQuantity(amount, unit, locale);
  const money = formatMoney(amount, locale, currency);
  return unit ? `${money} / ${unit}` : money;
}
