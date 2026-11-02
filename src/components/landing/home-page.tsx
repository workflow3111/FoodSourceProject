import { getTranslations } from "next-intl/server";
import {
  Apple,
  ArrowLeftRight,
  Beef,
  ChevronRight,
  CupSoda,
  Fish,
  LayoutGrid,
  Milk,
  Package,
  Search,
  Snowflake,
  Star,
  Users,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { ErrorState } from "@/components/catalog/chrome";
import { ProductTypeLinks } from "@/components/catalog/product-type-links";
import { Link } from "@/i18n/navigation";
import { getCategories, getProductTypeCounts } from "@/server/catalog";
import { DataError } from "@/server/catalog-types";
import { HeroSearch } from "./hero-search";

const categoryOrder = ["meat", "fish", "produce", "dairy", "grocery", "frozen", "drinks", "packaging"] as const;

const categoryVisuals: Record<string, { icon: LucideIcon; tone: string }> = {
  meat: { icon: Beef, tone: "bg-rose-50 text-rose-600" },
  fish: { icon: Fish, tone: "bg-sky-50 text-sky-600" },
  produce: { icon: Apple, tone: "bg-emerald-50 text-emerald-600" },
  dairy: { icon: Milk, tone: "bg-violet-50 text-violet-600" },
  grocery: { icon: Wheat, tone: "bg-amber-50 text-amber-700" },
  frozen: { icon: Snowflake, tone: "bg-cyan-50 text-cyan-600" },
  drinks: { icon: CupSoda, tone: "bg-orange-50 text-orange-600" },
  packaging: { icon: Package, tone: "bg-stone-100 text-stone-600" },
};

type HomeCategory = { slug: string; nameRu: string; nameEn: string; count: number };

export async function HomePage({ locale }: { locale: string }) {
  const t = await getTranslations("Landing");
  const catalog = await getTranslations("CategoriesPage");
  const productCatalog = await getTranslations("Catalog");
  const [loaded, productTypeCounts] = await Promise.all([loadCategories(), loadProductTypes()]);
  const categories = loaded ? orderedCategories(loaded) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,1fr)]">
        <div>
          <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            {t("titleStart")}{" "}
            <span className="text-primary">{t("titleAccent")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">{t("subtitle")}</p>
          <HeroSearch />
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-primary">
            <Link href="/suppliers" className="inline-flex items-center gap-2 hover:underline">
              <Users className="size-4" />
              {t("browseSuppliers")}
              <ChevronRight className="size-4" />
            </Link>
            <Link href="/categories" className="inline-flex items-center gap-2 hover:underline">
              <LayoutGrid className="size-4" />
              {t("browseCategories")}
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
        <img
          src="/landing-food.jpg"
          alt={t("foodImage")}
          className="h-72 w-full rounded-2xl border object-cover shadow-sm sm:h-80 lg:h-full lg:max-h-[26rem]"
        />
      </section>

      <section className="mt-8 rounded-2xl border bg-card shadow-sm">
        <div className="grid gap-8 p-5 md:grid-cols-3 md:divide-x">
          <Feature icon={Search} title={t("searchTitle")} text={t("searchText")} />
          <Feature icon={ArrowLeftRight} title={t("compareTitle")} text={t("compareText")} />
          <Feature icon={Star} title={t("saveTitle")} text={t("saveText")} />
        </div>
      </section>

      {productTypeCounts ? (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">{t("productTypesTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("productTypesText")}</p>
          <div className="mt-5">
            <ProductTypeLinks
              label={(type) => productCatalog(`productTypes.${type}`)}
              counts={productTypeCounts}
              countText={(count) => catalog("count", { count })}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t("categoriesTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("categoriesText")}</p>
          {categories === null ? (
            <div className="mt-5">
              <ErrorState title={catalog("errorTitle")} text={catalog("errorText")} action={catalog("retry")} />
            </div>
          ) : categories.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">{catalog("empty")}</p>
          ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/suppliers?category=${category.slug}`}
                  className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm hover:border-primary/40"
                >
                  <CategoryMark slug={category.slug} />
                  <span>{locale === "en" ? category.nameEn : category.nameRu}</span>
                </Link>
              </li>
            ))}
          </ul>
          )}
          <Link
            href="/categories"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-primary/30 px-4 text-sm font-medium text-primary hover:bg-primary/5"
          >
            {t("seeAllCategories")}
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="md:px-4 md:first:pl-0 md:last:pr-0">
      <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function CategoryMark({ slug }: { slug: string }) {
  const visual = categoryVisuals[slug] ?? { icon: Package, tone: "bg-muted text-muted-foreground" };
  const Icon = visual.icon;
  return (
    <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${visual.tone}`}>
      <Icon className="size-5" />
    </span>
  );
}

function orderedCategories(categories: HomeCategory[]) {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const known = categoryOrder.flatMap((slug) => {
    const category = bySlug.get(slug);
    return category ? [category] : [];
  });
  const extra = categories.filter((category) => !categoryOrder.includes(category.slug as (typeof categoryOrder)[number]));
  return [...known, ...extra];
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
