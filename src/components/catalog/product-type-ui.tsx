"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProductPhoto } from "@/components/catalog/catalog-media";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { productTypes, type ProductType } from "@/lib/product-type";
import type { CatalogProduct } from "@/server/catalog-types";

const ProductTypeContext = createContext<{
  selected: ProductType | "";
  setSelected: (value: ProductType | "") => void;
} | null>(null);

export function ProductTypeProvider({
  initial = "",
  children,
}: {
  initial?: ProductType | "";
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<ProductType | "">(initial);
  return <ProductTypeContext.Provider value={{ selected, setSelected }}>{children}</ProductTypeContext.Provider>;
}

export function ProductTypeBadge({ type }: { type: ProductType }) {
  const t = useTranslations("Catalog");
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeTone[type]}`}>
      {t(`productTypes.${type}`)}
    </span>
  );
}

export function ProductTypeFilterBar() {
  const t = useTranslations("Catalog");
  const context = useContext(ProductTypeContext);
  if (!context) return null;
  const { selected, setSelected } = context;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-muted-foreground">{t("productType")}</span>
      <FilterButton active={selected === ""} onClick={() => setSelected("")}>
        {t("productTypeAll")}
      </FilterButton>
      {productTypes.map((type) => (
        <FilterButton key={type} active={selected === type} onClick={() => setSelected(type)}>
          {t(`productTypes.${type}`)}
        </FilterButton>
      ))}
    </div>
  );
}

export function SupplierProductSection({
  products,
  locale,
  initialType = "",
}: {
  products: CatalogProduct[];
  locale: string;
  initialType?: ProductType | "";
}) {
  const t = useTranslations("Profile");
  const catalog = useTranslations("Catalog");
  const categoryKey = locale === "en" ? "categoryNameEn" : "categoryNameRu";

  return (
    <ProductTypeProvider initial={initialType}>
      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Tag className="size-4 text-muted-foreground" />
            {t("products")}
          </h2>
        </div>
        <div className="mt-3">
          <ProductTypeFilterBar />
        </div>
        <FilteredProductList products={products} locale={locale} categoryKey={categoryKey} catalog={catalog} updatedLabel={t("updated")} />
      </section>
    </ProductTypeProvider>
  );
}

function FilteredProductList({
  products,
  locale,
  categoryKey,
  catalog,
  updatedLabel,
}: {
  products: CatalogProduct[];
  locale: string;
  categoryKey: "categoryNameRu" | "categoryNameEn";
  catalog: ReturnType<typeof useTranslations<"Catalog">>;
  updatedLabel: string;
}) {
  const t = useTranslations("Catalog");
  const selected = useContext(ProductTypeContext)?.selected ?? "";
  const visible = selected ? products.filter((product) => product.productType === selected) : products;

  return (
    <>
      {visible.length ? (
        <ul className="mt-2 divide-y">
          {visible.map((product) => (
            <li key={product.id} className="flex gap-3 py-4">
              <ProductPhoto
                product={product}
                size={80}
                demoAlt={catalog("productAlt", { name: product.name })}
                realAlt={catalog("productAltReal", { name: product.name })}
                missingAlt={catalog("productMissing", { name: product.name })}
                demoMark={catalog("demoMark")}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{product.name}</p>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    <ProductTypeBadge type={product.productType} />
                    <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {product[categoryKey]}
                    </span>
                  </span>
                </div>
                <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Fact
                    label={catalog("price")}
                    value={
                      product.price == null
                        ? catalog("priceUnavailable")
                        : `${formatMoney(product.price, locale, product.currency)}${product.unit ? ` / ${product.unit}` : ""}`
                    }
                    missing={product.price == null}
                  />
                  <Fact
                    label={catalog("moq")}
                    value={product.moq == null ? catalog("moqUnavailable") : formatQuantity(product.moq, product.unit, locale)}
                    missing={product.moq == null}
                  />
                  <Fact
                    label={updatedLabel}
                    value={
                      product.price != null && product.priceUpdatedAt
                        ? formatDate(product.priceUpdatedAt, locale)
                        : catalog("unavailable")
                    }
                    missing={product.price == null || !product.priceUpdatedAt}
                  />
                </dl>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{selected ? t("productTypeEmpty") : catalog("unavailable")}</p>
      )}
    </>
  );
}

export function CompareProductList({
  products,
  locale,
}: {
  products: CatalogProduct[];
  locale: string;
}) {
  const t = useTranslations("Catalog");
  const selected = useContext(ProductTypeContext)?.selected ?? "";
  const categoryKey = locale === "en" ? "categoryNameEn" : "categoryNameRu";
  const shown = selected ? products.filter((product) => product.productType === selected) : products.slice(0, 4);

  if (!products.length && !selected) return null;
  if (!shown.length) {
    return <p className="text-sm text-muted-foreground">{t("productTypeEmpty")}</p>;
  }

  return (
    <ul className="space-y-2">
      {shown.map((product) => (
        <li key={product.id} className="flex items-center gap-2">
          <ProductPhoto
            product={product}
            size={48}
            demoAlt={t("productAlt", { name: product.name })}
            realAlt={t("productAltReal", { name: product.name })}
            missingAlt={t("productMissing", { name: product.name })}
            demoMark={t("demoMark")}
          />
          <span className="min-w-0">
            {product.name}
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <ProductTypeBadge type={product.productType} />
              <span className="text-xs text-muted-foreground">{product[categoryKey]}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Fact({ label, value, missing }: { label: string; value: string; missing: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm ${missing ? "text-muted-foreground" : "font-medium"}`}>{value}</dd>
    </div>
  );
}

const badgeTone: Record<ProductType, string> = {
  INGREDIENTS: "border-emerald-200 bg-emerald-50 text-emerald-900",
  FINISHED_PRODUCTS: "border-sky-200 bg-sky-50 text-sky-900",
  PACKAGING: "border-orange-200 bg-orange-50 text-orange-900",
  OTHER_FOOD_RELATED_GOODS: "border-border bg-muted text-muted-foreground",
};
