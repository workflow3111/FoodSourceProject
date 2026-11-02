import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { CardSkeletonGrid, EmptyState, ErrorState } from "@/components/catalog/chrome";
import { ActiveFilters, DiscoveryFilters, DiscoverySort } from "@/components/catalog/discovery-filters";
import { SupplierCard } from "@/components/catalog/supplier-card";
import { Link } from "@/i18n/navigation";
import { assertLocale } from "@/i18n/locale";
import { compareCookieName, parseCompareSlugs } from "@/lib/comparison";
import { parseDiscoveryQuery, toSearchParams } from "@/lib/discovery-query";
import { defaultMatchWeights } from "@/server/matching";
import { requestClock } from "@/lib/today";
import { getWorkspace, searchSuppliers } from "@/server/catalog";
import { discoveryPageSize } from "@/server/supplier-search";
import { DataError } from "@/server/catalog-types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Discovery" });
  return { title: t("title") };
}

export default async function SuppliersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = assertLocale((await params).locale);
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <Suspense fallback={<CardSkeletonGrid />}>
        <DiscoveryResults locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function DiscoveryResults({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("Discovery");
  const query = parseDiscoveryQuery(await searchParams);
  const loaded = await loadDiscovery(query);

  if (!loaded) {
    return <ErrorState title={t("errorTitle")} text={t("errorText")} action={t("retry")} />;
  }

  const { result, savedIds, observedAt, timeZone, comparing } = loaded;

  return (
      <div className="space-y-4">
        <DiscoveryFilters
          query={{ ...query, page: result.page }}
          total={result.total}
          categories={result.facets.categories}
          cities={result.facets.cities}
          regions={result.facets.regions}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium">{t("results", { count: result.total })}</p>
            {result.total > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("showing", {
                  start: (result.page - 1) * discoveryPageSize + 1,
                  end: Math.min(result.page * discoveryPageSize, result.total),
                  total: result.total,
                })}
              </p>
            ) : null}
          </div>
          <DiscoverySort query={query} />
        </div>
        <ActiveFilters query={query} categories={result.facets.categories} />
        {result.comparable === false ? (
          <p className="max-w-xl text-sm text-muted-foreground">{t("sortNotComparable")}</p>
        ) : null}
        {result.showScore ? (
          <p className="max-w-xl text-xs leading-5 text-primary">
            {t("scoreNote", {
              product: Math.round(defaultMatchWeights.product * 100),
              geography: Math.round(defaultMatchWeights.geography * 100),
              price: Math.round(defaultMatchWeights.price * 100),
              moq: Math.round(defaultMatchWeights.moq * 100),
              certification: Math.round(defaultMatchWeights.certification * 100),
              delivery: Math.round(defaultMatchWeights.delivery * 100),
            })}
          </p>
        ) : null}
        {result.items.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            text={t("emptyText")}
            href="/suppliers"
            action={t("clear")}
          />
        ) : (
          <div className="grid gap-4">
            {result.items.map(({ supplier, report }) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                locale={locale}
                saved={savedIds.has(supplier.id)}
                comparing={comparing.has(supplier.slug)}
                report={report}
                profileHref={profileHref(supplier.slug, query)}
                observedAt={observedAt}
                timeZone={timeZone}
                context={{
                  query: query.q,
                  category: query.category,
                  city: query.city,
                  region: query.region,
                  maxPrice: query.maxPrice == null ? "" : String(query.maxPrice),
                  maxMoq: query.maxMoq == null ? "" : String(query.maxMoq),
                  certified: query.certified,
                }}
              />
            ))}
          </div>
        )}
        <Pagination page={result.page} pages={result.pages} query={query} />
      </div>
    );
}

async function loadDiscovery(query: ReturnType<typeof parseDiscoveryQuery>) {
  try {
    const [result, workspace, jar, clock] = await Promise.all([
      searchSuppliers(query),
      getWorkspace(),
      cookies(),
      requestClock(),
    ]);

    return {
      result,
      savedIds: new Set(workspace.map((entry) => entry.supplierId)),
      observedAt: clock.observedAt,
      timeZone: clock.timeZone,
      comparing: new Set(parseCompareSlugs(jar.get(compareCookieName)?.value)),
    };
  } catch (error) {
    if (!(error instanceof DataError)) throw error;
    return null;
  }
}

function profileHref(slug: string, query: ReturnType<typeof parseDiscoveryQuery>) {
  const params = toSearchParams(query, 1);
  params.delete("page");
  const search = params.toString();
  return search ? `/suppliers/${slug}?${search}` : `/suppliers/${slug}`;
}

function Pagination({
  page,
  pages,
  query,
}: {
  page: number;
  pages: number;
  query: ReturnType<typeof parseDiscoveryQuery>;
}) {
  if (pages <= 1) return null;

  return (
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link href={`/suppliers?${toSearchParams(query, page - 1).toString()}`} className="rounded-md border bg-card px-3 py-2">
          ←
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link href={`/suppliers?${toSearchParams(query, page + 1).toString()}`} className="rounded-md border bg-card px-3 py-2">
          →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
