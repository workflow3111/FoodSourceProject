import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ErrorState, PanelSkeleton } from "@/components/catalog/chrome";
import { SupplierProfile } from "@/components/catalog/supplier-profile";
import { assertLocale } from "@/i18n/locale";
import { compareCookieName, parseCompareSlugs } from "@/lib/comparison";
import { hasRankingContext, parseDiscoveryQuery, toSearchParams } from "@/lib/discovery-query";
import { requestClock } from "@/lib/today";
import { getSupplier, getWorkspace, scoreSupplier } from "@/server/catalog";
import { DataError } from "@/server/catalog-types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale: assertLocale(locale),
    namespace: "Profile",
  });
  return { title: t("title") };
}

export default function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><PanelSkeleton /></div>}>
      <Detail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: localeParam, slug } = await params;
  const locale = assertLocale(localeParam);
  setRequestLocale(locale);
  const t = await getTranslations("Profile");
  const loaded = await loadDetail(slug, await searchParams);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <ErrorState title={t("errorTitle")} text={t("errorText")} action={t("retry")} />
      </div>
    );
  }

  const supplier = loaded.supplier;

  if (!supplier) {
    notFound();
  }

  const entry = loaded.workspace.find((item) => item.supplierId === supplier.id) ?? null;

  return (
    <SupplierProfile
      supplier={supplier}
      locale={locale}
      saved={entry != null}
      comparing={loaded.comparing}
      workspace={entry}
      report={loaded.report}
      listHref={loaded.listHref}
      matchContext={loaded.matchContext}
      scoreBasis={loaded.scoreBasis}
      today={loaded.today}
      observedAt={loaded.observedAt}
      timeZone={loaded.timeZone}
      productType={loaded.productType}
    />
  );
}

async function loadDetail(slug: string, rawQuery: Record<string, string | string[] | undefined>) {
  try {
    const jar = await cookies();
    const query = parseDiscoveryQuery(rawQuery);
    const ranked = hasRankingContext(query);
    const scoreBasis = ranked ? ("search" as const) : ("catalog" as const);
    const [supplier, workspace, clock] = await Promise.all([getSupplier(slug), getWorkspace(), requestClock()]);
    const report = supplier ? await scoreSupplier(supplier, query) : null;
    const search = toSearchParams(query).toString();

    return {
      supplier,
      workspace,
      report,
      scoreBasis,
      today: clock.today,
      observedAt: clock.observedAt,
      timeZone: clock.timeZone,
      productType: query.productType,
      listHref: search ? `/suppliers?${search}` : "/suppliers",
      matchContext: ranked
        ? {
            query: query.q,
            category: query.category,
            city: query.city,
            region: query.region,
            maxPrice: query.maxPrice == null ? "" : String(query.maxPrice),
            maxMoq: query.maxMoq == null ? "" : String(query.maxMoq),
            certified: query.certified,
          }
        : undefined,
      comparing: supplier
        ? parseCompareSlugs(jar.get(compareCookieName)?.value).includes(supplier.slug)
        : false,
    };
  } catch (error) {
    if (!(error instanceof DataError)) throw error;
    return null;
  }
}

