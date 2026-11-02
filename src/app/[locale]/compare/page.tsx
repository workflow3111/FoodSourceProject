import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { EmptyState, ErrorState, PageIntro, PanelSkeleton } from "@/components/catalog/chrome";
import { CompareView } from "@/components/catalog/compare-view";
import { ExportComparisonButton } from "@/components/catalog/export-comparison";
import { assertLocale } from "@/i18n/locale";
import { compareCookieName, matchContextCookieName, parseCompareSlugs, parseMatchContext } from "@/lib/comparison";
import { requestClock } from "@/lib/today";
import { getSuppliersBySlugs, getWorkspace } from "@/server/catalog";
import { DataError } from "@/server/catalog-types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Compare" });
  return { title: t("title") };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("Compare");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <PageIntro title={t("title")} description={t("description")} />
      <Suspense fallback={<PanelSkeleton />}>
        <Comparison locale={locale} />
      </Suspense>
    </div>
  );
}

async function Comparison({ locale }: { locale: string }) {
  const t = await getTranslations("Compare");
  const loaded = await loadComparison();

  if (!loaded) {
    return <ErrorState title={t("errorTitle")} text={t("errorText")} action={t("retry")} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportComparisonButton disabled={loaded.suppliers.length === 0} />
      </div>
      {loaded.suppliers.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          text={t("emptyText")}
          href="/suppliers"
          action={t("emptyAction")}
        />
      ) : (
        <CompareView
          suppliers={loaded.suppliers}
          workspace={loaded.workspace}
          locale={locale}
          timeZone={loaded.timeZone}
          context={loaded.context}
        />
      )}
    </div>
  );
}

async function loadComparison() {
  try {
    const jar = await cookies();
    const slugs = parseCompareSlugs(jar.get(compareCookieName)?.value);
    const stored = parseMatchContext(jar.get(matchContextCookieName)?.value);
    const [suppliers, workspace, clock] = await Promise.all([getSuppliersBySlugs(slugs), getWorkspace(), requestClock()]);
    return {
      suppliers,
      workspace,
      timeZone: clock.timeZone,
      context: {
        query: stored.query || undefined,
        category: stored.category || undefined,
        city: stored.city || undefined,
        region: stored.region || undefined,
        maxPrice: stored.maxPrice,
        maxMoq: stored.maxMoq,
        certified: stored.certified,
      },
    };
  } catch (error) {
    if (!(error instanceof DataError)) throw error;
    return null;
  }
}
