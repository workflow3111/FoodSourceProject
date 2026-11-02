import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import {
  Apple,
  Beef,
  ChevronRight,
  CupSoda,
  Fish,
  Milk,
  Package,
  ShoppingBasket,
  Snowflake,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { ErrorState, PageIntro, PanelSkeleton } from "@/components/catalog/chrome";
import { ProductTypeLinks } from "@/components/catalog/product-type-links";
import { Link } from "@/i18n/navigation";
import { assertLocale } from "@/i18n/locale";
import { getCategories, getProductTypeCounts } from "@/server/catalog";
import { DataError } from "@/server/catalog-types";

const categoryVisuals: Record<string, { icon: LucideIcon; tone: string }> = {
  meat: { icon: Beef, tone: "bg-rose-50 text-rose-600" },
  fish: { icon: Fish, tone: "bg-sky-50 text-sky-600" },
  produce: { icon: Apple, tone: "bg-emerald-50 text-emerald-600" },
  dairy: { icon: Milk, tone: "bg-violet-50 text-violet-600" },
  grocery: { icon: Wheat, tone: "bg-amber-50 text-amber-700" },
  frozen: { icon: Snowflake, tone: "bg-cyan-50 text-cyan-600" },
  drinks: { icon: CupSoda, tone: "bg-violet-50 text-violet-600" },
  packaging: { icon: Package, tone: "bg-orange-50 text-orange-700" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "CategoriesPage" });
  return { title: t("title") };
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("CategoriesPage");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <PageIntro title={t("title")} description={t("description")} />
      <Suspense fallback={<PanelSkeleton />}>
        <CategoryGrid locale={locale} />
      </Suspense>
    </div>
  );
}

async function CategoryGrid({ locale }: { locale: string }) {
  const t = await getTranslations("CategoriesPage");
  const catalog = await getTranslations("Catalog");
  const [categories, productTypeCounts] = await Promise.all([loadCategories(), loadProductTypes()]);

  if (!categories) {
    return <ErrorState title={t("errorTitle")} text={t("errorText")} action={t("retry")} />;
  }

  if (!categories.length) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-10">
      {productTypeCounts ? (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">{t("productTypesTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("productTypesText")}</p>
          <div className="mt-5">
            <ProductTypeLinks
              label={(type) => catalog(`productTypes.${type}`)}
              counts={productTypeCounts}
              countText={(count) => t("count", { count })}
            />
          </div>
        </section>
      ) : null}
      <section className={productTypeCounts ? "border-t pt-10" : undefined}>
        <h2 className="text-xl font-semibold tracking-tight">{t("categoriesSection")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("categoriesText")}</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => {
          const visual = categoryVisuals[category.slug] ?? { icon: Package, tone: "bg-muted text-muted-foreground" };
          const Icon = visual.icon;
          return (
            <li key={category.slug}>
              <Link
                href={`/suppliers?category=${category.slug}`}
                className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm hover:border-primary/30"
              >
                <span className="min-w-0 flex-1">
                  <span className={`flex size-11 items-center justify-center rounded-2xl ${visual.tone}`}>
                    <Icon className="size-5" />
                  </span>
                  <span className="mt-4 block font-semibold">
                    {locale === "en" ? category.nameEn : category.nameRu}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {t("count", { count: Number(category.count) })}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingBasket className="size-5" />
          </span>
          <div>
            <p className="font-semibold">{t("helpTitle")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("helpText")}</p>
          </div>
        </div>
        <Link
          href="/suppliers"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t("helpAction")}
          <ChevronRight className="size-4" />
        </Link>
      </div>
      </section>
    </div>
  );
}

async function loadCategories() {
  try {
    return await getCategories();
  } catch (error) {
    if (!(error instanceof DataError)) throw error;
    return null;
  }
}

async function loadProductTypes() {
  try {
    return await getProductTypeCounts();
  } catch (error) {
    if (!(error instanceof DataError)) throw error;
    return null;
  }
}
