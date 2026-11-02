import { SupplierLogo } from "@/components/catalog/catalog-media";
import { FreshnessIndicator } from "@/components/catalog/freshness-indicator";
import { ProductTypeBadge } from "@/components/catalog/product-type-ui";
import { CompareButton, FavoriteButton } from "@/components/catalog/supplier-actions";
import { isConfirmedCertificate } from "@/lib/certificate-status";
import { moqLine, placeLine, priceLine } from "@/components/catalog/supplier-facts";
import { Link } from "@/i18n/navigation";
import type { CatalogSupplier } from "@/server/catalog-types";
import type { MatchReport } from "@/server/matching";
import { getTranslations } from "next-intl/server";
import {
  Apple,
  Award,
  Beef,
  Building2,
  Coins,
  CupSoda,
  Factory,
  FileText,
  Fish,
  Info,
  Leaf,
  MapPin,
  Milk,
  Package,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Ship,
  Sprout,
  Store,
  Truck,
  Warehouse,
  Wheat,
  Snowflake,
  type LucideIcon,
} from "lucide-react";

const categoryIcons: Record<string, LucideIcon> = {
  meat: Beef,
  fish: Fish,
  produce: Leaf,
  dairy: Milk,
  grocery: Wheat,
  frozen: Snowflake,
  drinks: CupSoda,
  packaging: Package,
};

const typeIcons: Record<CatalogSupplier["supplierType"], LucideIcon> = {
  MANUFACTURER: Factory,
  DISTRIBUTOR: Store,
  FARM: Sprout,
  IMPORTER: Ship,
  PACKAGING: Package,
  WHOLESALER: Warehouse,
  OTHER: Building2,
};

export async function SupplierCard({
  supplier,
  locale,
  saved,
  comparing,
  report,
  context,
  profileHref,
  observedAt,
  timeZone,
}: {
  supplier: CatalogSupplier;
  locale: string;
  saved: boolean;
  comparing: boolean;
  report: MatchReport | null;
  context?: {
    query: string;
    category: string;
    city: string;
    region: string;
    maxPrice?: string;
    maxMoq?: string;
    certified?: boolean;
  };
  profileHref: string;
  observedAt: string;
  timeZone: string;
}) {
  const t = await getTranslations("Catalog");
  const categories = [
    ...new Map(
      supplier.products.map((product) => [
        product.categorySlug,
        locale === "en" ? product.categoryNameEn : product.categoryNameRu,
      ]),
    ),
  ];
  const place = placeLine(supplier);
  const price = priceLine(supplier, locale, (value) => t("priceFrom", { value }));
  const moq = moqLine(supplier, locale, (value) => t("moqFrom", { value }));
  const delivery = supplier.products.find((product) => product.deliveryNotes)?.deliveryNotes ?? null;
  const TypeIcon = typeIcons[supplier.supplierType];
  const confirmedCertificates = supplier.certifications.filter(
    (item) => !item.isDemo && isConfirmedCertificate(item),
  ).length;
  const verificationTone =
    supplier.verificationStatus === "EXPIRED"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : supplier.verificationStatus === "UNVERIFIED"
        ? "border-border text-muted-foreground"
        : "border-primary/30 bg-primary/10 text-primary";

  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <SupplierLogo
          supplier={supplier}
          size={56}
          demoAlt={t("logoAlt", { name: supplier.name })}
          realAlt={t("logoAltReal", { name: supplier.name })}
          missingAlt={t("logoMissing", { name: supplier.name })}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="flex min-w-0 items-center gap-1.5 text-base font-semibold tracking-tight">
              <Link href={profileHref} className="truncate hover:text-primary">
                {supplier.name}
              </Link>
              <NameShield status={supplier.verificationStatus} />
            </h2>
            <FavoriteButton supplierId={supplier.id} saved={saved} appearance="icon" />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{place || t("unavailable")}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {supplier.dataType === "DEMO" ? (
            <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
              {t("demoMark")}
            </span>
          ) : null}
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${verificationTone}`}>
            {t(`verification.${supplier.verificationStatus}`)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
            <TypeIcon className="size-3.5" />
            {t(`types.${supplier.supplierType}`)}
          </span>
          {categories.map(([slug, name]) => {
            const Icon = categoryIcons[slug] ?? Apple;
            return (
              <span key={slug} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                <Icon className="size-3.5" />
                {name}
              </span>
            );
          })}
          {[...new Set(supplier.products.map((product) => product.productType))].map((type) => (
            <ProductTypeBadge key={type} type={type} />
          ))}
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
            report?.score == null
              ? "border-border text-muted-foreground"
              : "border-primary/30 bg-primary/10 text-primary"
          }`}
          title={t("scoreHint")}
        >
          {report?.score == null ? t("scoreUnavailable") : t("scoreMatch", { score: report.score })}
        </span>
      </div>

      <section className="mt-5 border-t pt-4">
        <h3 className="text-sm font-semibold">{t("commercialSection")}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
          <CommercialFact
            icon={Coins}
            label={t("price")}
            value={price.kind === "missing" ? t("priceUnavailable") : price.text}
            missing={price.kind === "missing"}
          />
          <CommercialFact
            icon={Package}
            label={t("moq")}
            value={moq.kind === "missing" ? t("moqUnavailable") : moq.text}
            missing={moq.kind === "missing"}
          />
          <CommercialFact
            icon={Award}
            label={t("certifications")}
            value={
              supplier.certifications.length === 0
                ? t("noCerts")
                : t("certificateVerifiedCount", {
                    verified: confirmedCertificates,
                    total: supplier.certifications.length,
                  })
            }
            missing={supplier.certifications.length === 0}
          />
          <CommercialFact
            icon={Truck}
            label={t("delivery")}
            value={delivery ? t("deliveryRecorded") : t("deliveryUnavailable")}
            missing={!delivery}
          />
        </dl>
      </section>

      {supplier.description || delivery ? (
        <section className="mt-5 border-t pt-4">
          <h3 className="text-sm font-semibold">{t("overviewSection")}</h3>
          {supplier.description ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{supplier.description}</p>
          ) : null}
          {delivery ? <p className="mt-2 text-sm leading-6">{delivery}</p> : null}
          {delivery ? (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Info className="size-3.5 text-muted-foreground" />
                {t("deliveryInfo")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("deliveryRegionsNote")}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <FreshnessIndicator
        supplier={supplier}
        locale={locale}
        observedAt={observedAt}
        timeZone={timeZone}
        variant="card"
      />
      <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
        <Link
          href={profileHref}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-accent"
        >
          <FileText className="size-4" />
          {t("viewProfile")}
        </Link>
        <CompareButton slug={supplier.slug} active={comparing} context={context} className="h-11 w-full rounded-lg" showIcon />
      </div>
    </article>
  );
}

function NameShield({
  status,
  compact = false,
}: {
  status: CatalogSupplier["verificationStatus"];
  compact?: boolean;
}) {
  const size = compact ? "size-3.5 shrink-0" : "size-5 shrink-0";
  if (status === "VERIFIED" || status === "PARTIALLY_VERIFIED") {
    return <ShieldCheck className={`${size} text-primary`} aria-hidden />;
  }
  if (status === "EXPIRED") {
    return <ShieldAlert className={`${size} text-amber-600`} aria-hidden />;
  }
  return <ShieldQuestion className={`${size} text-muted-foreground`} aria-hidden />;
}

function CommercialFact({
  icon: Icon,
  label,
  value,
  missing,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  missing: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </dt>
      <dd className={`mt-1 text-sm font-semibold leading-5 ${missing ? "font-medium text-muted-foreground" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
