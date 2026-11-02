"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contactStatuses } from "@/lib/contact-tracking";
import { freshnessStatuses } from "@/lib/freshness";
import { sortOptions, toSearchParams, type DiscoveryQuery, type SupplierTypeFilter } from "@/lib/discovery-query";
import { productTypes } from "@/lib/product-type";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const types: SupplierTypeFilter[] = [
  "MANUFACTURER",
  "DISTRIBUTOR",
  "FARM",
  "IMPORTER",
  "PACKAGING",
  "WHOLESALER",
];

export function DiscoveryFilters({
  query,
  total,
  categories,
  cities,
  regions,
}: {
  query: DiscoveryQuery;
  total: number;
  categories: { slug: string; nameRu: string; nameEn: string }[];
  cities: string[];
  regions: string[];
}) {
  const t = useTranslations("Discovery");
  const catalog = useTranslations("Catalog");
  const freshness = useTranslations("Freshness");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const advancedCount = countAdvanced(query);
  const [advancedPreference, setAdvancedPreference] = useState<"auto" | boolean>("auto");
  const advancedOpen = advancedPreference === "auto" ? advancedCount > 0 : advancedPreference;
  const categoryName = (item: { nameRu: string }) => item.nameRu;

  function navigate(params: URLSearchParams) {
    const search = params.toString();
    startTransition(() => {
      router.push(search ? `${pathname}?${search}` : pathname);
    });
  }

  function apply(formData: FormData) {
    const params = new URLSearchParams();
    const values: Record<string, string> = {
      q: String(formData.get("q") ?? "").trim(),
      category: String(formData.get("category") ?? ""),
      city: String(formData.get("city") ?? ""),
      region: String(formData.get("region") ?? ""),
      type: String(formData.get("type") ?? ""),
      productType: String(formData.get("productType") ?? ""),
      contact: String(formData.get("contact") ?? ""),
      freshness: String(formData.get("freshness") ?? ""),
      maxPrice: String(formData.get("maxPrice") ?? "").trim(),
      maxMoq: String(formData.get("maxMoq") ?? "").trim(),
    };

    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }

    if (query.sort !== "name") params.set("sort", query.sort);
    if (query.scope !== "all") params.set("scope", query.scope);
    if (formData.get("certified") === "on") params.set("certified", "1");
    const certificate = String(formData.get("certificate") ?? "");
    if (certificate) params.set("certificate", certificate);
    navigate(params);
  }

  function resetFilters() {
    setAdvancedPreference("auto");
    const params = new URLSearchParams();
    if (query.sort !== "name") params.set("sort", query.sort);
    navigate(params);
  }

  const appliedKey = [
    query.q,
    query.scope,
    query.category,
    query.city,
    query.region,
    query.type,
    query.productType,
    query.certified ? "1" : "",
    query.certificate,
    query.maxPrice ?? "",
    query.maxMoq ?? "",
    query.contact,
    query.freshness,
  ].join("\n");

  return (
    <form
      key={appliedKey}
      onSubmit={(event) => {
        event.preventDefault();
        apply(new FormData(event.currentTarget));
      }}
      className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <h2 className="text-sm font-medium">{t("filtersTitle")}</h2>
      <div className="mt-4 space-y-4">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("search")}</span>
          <span className="flex h-11 items-center rounded-lg border bg-card focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <Search className="ml-3 size-4 shrink-0 text-muted-foreground" />
            <input
              name="q"
              defaultValue={query.q}
              placeholder={t("searchPlaceholder")}
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </span>
        </label>

        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select name="category" label={t("category")} defaultValue={query.category}>
            <option value="">{t("anyCategory")}</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {categoryName(item)}
              </option>
            ))}
          </Select>
          <Select name="city" label={t("city")} defaultValue={query.city}>
            <option value="">{t("anyCity")}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
          <Select name="region" label={t("region")} defaultValue={query.region}>
            <option value="">{t("anyRegion")}</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </Select>
          <Select name="type" label={t("type")} defaultValue={query.type}>
            <option value="">{t("anyType")}</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {catalog(`types.${type}`)}
              </option>
            ))}
          </Select>
          <Select name="productType" label={t("productType")} defaultValue={query.productType}>
            <option value="">{t("anyProduct")}</option>
            {productTypes.map((type) => (
              <option key={type} value={type}>
                {catalog(`productTypes.${type}`)}
              </option>
            ))}
          </Select>
          <Select name="contact" label={t("contact")} defaultValue={query.contact}>
            <option value="">{t("anyStatus")}</option>
            {contactStatuses.map((status) => (
              <option key={status} value={status}>
                {catalog(`contactStatus.${status}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="border-t pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg py-1.5 text-left text-sm font-medium hover:text-foreground"
            aria-expanded={advancedOpen}
            aria-controls="advanced-filters"
            onClick={() => setAdvancedPreference(!advancedOpen)}
          >
            <span className="flex items-center gap-2">
              {t("advancedFilters")}
              {!advancedOpen && advancedCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
                  {advancedCount}
                </span>
              ) : null}
            </span>
            <ChevronDown className={`size-4 text-muted-foreground ${advancedOpen ? "rotate-180" : ""}`} />
          </button>
          <div id="advanced-filters" className={advancedOpen ? "mt-3 space-y-3" : "hidden"}>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <Select name="certificate" label={t("certificateFilter")} defaultValue={query.certificate}>
                <option value="">{t("certificateAny")}</option>
                <option value="verified">{t("certificateVerified")}</option>
                <option value="valid">{t("certificateValid")}</option>
                <option value="expiring">{t("certificateExpiring")}</option>
                <option value="expired">{t("certificateExpired")}</option>
                <option value="unverified">{t("certificateUnverified")}</option>
              </Select>
              <Select name="freshness" label={freshness("filter")} defaultValue={query.freshness}>
                <option value="">{t("anyFreshness")}</option>
                {freshnessStatuses.map((status) => (
                  <option key={status} value={status}>
                    {freshness(status)}
                  </option>
                ))}
              </Select>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("maxPrice")}</span>
                <Input
                  name="maxPrice"
                  inputMode="decimal"
                  defaultValue={query.maxPrice ?? ""}
                  placeholder={t("pricePlaceholder")}
                  className="h-10 rounded-lg text-sm"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("maxMoq")}</span>
                <Input
                  name="maxMoq"
                  inputMode="decimal"
                  defaultValue={query.maxMoq ?? ""}
                  placeholder={t("moqPlaceholder")}
                  className="h-10 rounded-lg text-sm"
                />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="certified"
                defaultChecked={query.certified}
                aria-describedby="certified-hint"
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                {t("certified")}
                <span id="certified-hint" className="mt-0.5 block text-xs text-muted-foreground">
                  {t("certifiedHint")}
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" className="h-10" disabled={pending} onClick={resetFilters}>
            {t("clearAll")}
          </Button>
          <Button type="submit" className="h-10 sm:min-w-44" disabled={pending} aria-busy={pending}>
            {pending ? t("searching") : t("applyCount", { count: total })}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function DiscoverySort({ query }: { query: DiscoveryQuery }) {
  const t = useTranslations("Discovery");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <label className="block w-full sm:w-64">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("sort")}</span>
      <select
        value={query.sort}
        disabled={pending}
        aria-busy={pending}
        onChange={(event) => {
          const params = toSearchParams({ ...query, sort: event.target.value as DiscoveryQuery["sort"], page: 1 }, 1);
          const search = params.toString();
          startTransition(() => {
            router.push(search ? `${pathname}?${search}` : pathname);
          });
        }}
        className="h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.label)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ActiveFilters({
  query,
  categories,
}: {
  query: DiscoveryQuery;
  categories: { slug: string; nameRu: string; nameEn: string }[];
}) {
  const t = useTranslations("Discovery");
  const catalog = useTranslations("Catalog");
  const freshness = useTranslations("Freshness");
  const chips = filterChips(query, {
    category: categories.find((item) => item.slug === query.category)?.nameRu ?? query.category,
    type: query.type ? catalog(`types.${query.type}`) : "",
    productType: query.productType ? catalog(`productTypes.${query.productType}`) : "",
    contact: query.contact ? catalog(`contactStatus.${query.contact}`) : "",
    certificate: certificateLabel(query.certificate, t),
    freshness: query.freshness ? freshness(query.freshness) : "",
    scope: query.scope === "all" ? "" : t(scopeLabel[query.scope]),
    price: t("priceChip", { value: query.maxPrice ?? "" }),
    moq: t("moqChip", { value: query.maxMoq ?? "" }),
    certified: t("certified"),
  });

  if (!chips.length) return null;

  const clearParams = toSearchParams(
    {
      ...query,
      q: "",
      scope: "all",
      category: "",
      city: "",
      region: "",
      type: "",
      productType: "",
      certified: false,
      certificate: "",
      contact: "",
      freshness: "",
      maxPrice: null,
      maxMoq: null,
      page: 1,
    },
    1,
  );
  const clearSearch = clearParams.toString();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          className="inline-flex h-7 items-center gap-1 rounded-full border bg-muted/40 px-2.5 text-xs text-foreground hover:bg-muted"
        >
          <span>{chip.label}</span>
          <X className="size-3 text-muted-foreground" aria-hidden />
          <span className="sr-only">{t("removeFilter")}</span>
        </Link>
      ))}
      {chips.length > 1 ? (
        <Link href={clearSearch ? `/suppliers?${clearSearch}` : "/suppliers"} className="px-1 text-xs text-muted-foreground hover:text-foreground">
          {t("clearAll")}
        </Link>
      ) : null}
    </div>
  );
}

function countAdvanced(query: DiscoveryQuery) {
  return [
    query.certificate,
    query.freshness,
    query.maxPrice != null ? "1" : "",
    query.maxMoq != null ? "1" : "",
    query.certified ? "1" : "",
  ].filter(Boolean).length;
}

const scopeLabel = {
  all: "scopeAll",
  name: "scopeName",
  product: "scopeProduct",
  place: "scopePlace",
} as const;

function certificateLabel(
  value: DiscoveryQuery["certificate"],
  t: ReturnType<typeof useTranslations<"Discovery">>,
) {
  if (value === "verified") return t("certificateVerified");
  if (value === "valid") return t("certificateValid");
  if (value === "expiring") return t("certificateExpiring");
  if (value === "expired") return t("certificateExpired");
  if (value === "unverified") return t("certificateUnverified");
  return "";
}

function filterChips(
  query: DiscoveryQuery,
  labels: {
    category: string;
    type: string;
    productType: string;
    contact: string;
    certificate: string;
    freshness: string;
    scope: string;
    price: string;
    moq: string;
    certified: string;
  },
) {
  const items: Array<{ key: string; label: string; href: string }> = [];
  const add = (key: string, label: string, patch: Partial<DiscoveryQuery>) => {
    if (!label) return;
    const params = toSearchParams({ ...query, page: 1, ...patch }, 1);
    const search = params.toString();
    items.push({ key, label, href: search ? `/suppliers?${search}` : "/suppliers" });
  };

  add("q", query.q, { q: "" });
  add("scope", labels.scope, { scope: "all" });
  add("category", labels.category, { category: "" });
  add("city", query.city, { city: "" });
  add("region", query.region, { region: "" });
  add("type", labels.type, { type: "" });
  add("productType", labels.productType, { productType: "" });
  add("contact", labels.contact, { contact: "" });
  add("certificate", labels.certificate, { certificate: "" });
  add("freshness", labels.freshness, { freshness: "" });
  if (query.maxPrice != null) add("maxPrice", labels.price, { maxPrice: null });
  if (query.maxMoq != null) add("maxMoq", labels.moq, { maxMoq: null });
  if (query.certified) add("certified", labels.certified, { certified: false });

  return items;
}

function Select({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {children}
      </select>
    </label>
  );
}
