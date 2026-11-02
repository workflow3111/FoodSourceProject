import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { SupplierLogo } from "@/components/catalog/catalog-media";
import { ErrorState, PanelSkeleton } from "@/components/catalog/chrome";
import { ProductTypeLinks } from "@/components/catalog/product-type-links";
import { RefreshDashboard } from "@/components/catalog/refresh-dashboard";
import { Link } from "@/i18n/navigation";
import { assertLocale } from "@/i18n/locale";
import { formatDate } from "@/lib/format";
import { requestClock } from "@/lib/today";
import { DataError } from "@/server/catalog-types";
import { getDashboard } from "@/server/catalog";
import {
  Apple,
  Beef,
  Bookmark,
  Box,
  ChevronRight,
  CupSoda,
  Fish,
  MapPin,
  Milk,
  Package,
  Snowflake,
  Users,
  Wheat,
  type LucideIcon,
} from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Dashboard" });
  return { title: t("title") };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
        </div>
        <RefreshDashboard label={t("refreshed")} pendingLabel={t("refreshing")} />
      </div>
      <Suspense fallback={<PanelSkeleton />}>
        <DashboardContent locale={locale} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ locale }: { locale: string }) {
  const t = await getTranslations("Dashboard");
  const catalog = await getTranslations("Catalog");
  const data = await loadDashboard();

  if (!data) {
    return <ErrorState title={t("errorTitle")} text={t("errorText")} action={t("retry")} />;
  }

  const stats = [
    { label: t("suppliers"), value: data.supplierCount, hint: t("supplierHint"), icon: Users },
    { label: t("categories"), value: data.categoryCount, hint: t("categoryHint"), icon: Box },
    { label: t("regions"), value: data.regionCount, hint: t("regionHint"), icon: MapPin },
    { label: t("saved"), value: data.savedCount, hint: t("savedHint"), icon: Bookmark },
  ];
  const maxCategory = Math.max(...data.popular.map((category) => category.count), 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <section key={stat.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <stat.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm text-muted-foreground">{stat.label}</h2>
                <p className="text-3xl font-semibold tracking-tight text-primary">{stat.value}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{stat.hint}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
      <section>
        <h2 className="text-base font-semibold">{t("productTypes")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("productTypesText")}</p>
        <div className="mt-4">
          <ProductTypeLinks
            label={(type) => catalog(`productTypes.${type}`)}
            counts={data.productTypeCounts}
            countText={(count) => t("supplierCount", { count })}
          />
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{t("recent")}</h2>
            <Link
              href="/suppliers"
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {t("viewAll")}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
          <ul className="mt-2 divide-y">
            {data.recent.map((supplier) => {
              const place = [supplier.city, supplier.region].filter(Boolean).join(", ");
              return (
                <li key={supplier.id}>
                  <Link
                    href={`/suppliers/${supplier.slug}`}
                    className="flex items-center gap-3 py-3 hover:text-primary"
                  >
                    <SupplierLogo
                      supplier={supplier}
                      size={40}
                      demoAlt={catalog("logoAlt", { name: supplier.name })}
                      realAlt={catalog("logoAltReal", { name: supplier.name })}
                      missingAlt={catalog("logoMissing", { name: supplier.name })}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{supplier.name}</span>
                      {place ? (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{place}</span>
                        </span>
                      ) : null}
                    </span>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={supplier.createdAt}>
                      {formatDate(supplier.createdAt, locale)}
                    </time>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">{t("popular")}</h2>
          <ul className="mt-4 space-y-4">
            {data.popular.map((category) => {
              const name = locale === "en" ? category.nameEn : category.nameRu;
              const width = Math.max(8, Math.round((category.count / maxCategory) * 100));
              const share = data.supplierCount === 0 ? 0 : (category.count / data.supplierCount) * 100;
              const Icon = categoryIcon(category.slug);
              const tone = categoryTone(category.slug);
              return (
                <li key={category.slug}>
                  <Link href={`/suppliers?category=${category.slug}`} className="group block">
                    <div className="flex items-center gap-3">
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-primary">
                        {name}
                      </span>
                      <span className="w-6 text-right text-sm tabular-nums">{category.count}</span>
                      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                        {formatShare(share, locale)}
                      </span>
                    </div>
                    <div className="mt-2 ml-11 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function formatShare(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
}

function categoryIcon(slug: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    meat: Beef,
    fish: Fish,
    produce: Apple,
    dairy: Milk,
    grocery: Wheat,
    frozen: Snowflake,
    drinks: CupSoda,
    packaging: Package,
  };
  return icons[slug] ?? Package;
}

function categoryTone(slug: string) {
  const tones: Record<string, string> = {
    meat: "bg-rose-50 text-rose-600",
    fish: "bg-sky-50 text-sky-600",
    produce: "bg-emerald-50 text-emerald-600",
    dairy: "bg-violet-50 text-violet-600",
    grocery: "bg-amber-50 text-amber-700",
    frozen: "bg-cyan-50 text-cyan-600",
    drinks: "bg-orange-50 text-orange-600",
    packaging: "bg-stone-100 text-stone-600",
  };
  return tones[slug] ?? "bg-muted text-muted-foreground";
}

async function loadDashboard() {
  try {
    const clock = await requestClock();
    return await getDashboard(new Date(clock.observedAt));
  } catch (error) {
    if (!(error instanceof DataError)) throw error;
    return null;
  }
}
