import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { comparisonExportFilename } from "@/lib/csv";
import { buildComparisonCsv, comparisonExportColumns, type ComparisonExportLabels } from "@/lib/comparison-export";
import { compareCookieName, matchContextCookieName, parseCompareSlugs, parseMatchContext } from "@/lib/comparison";
import { freshnessStatuses } from "@/lib/freshness";
import { productTypes } from "@/lib/product-type";
import { contactStatuses } from "@/lib/contact-tracking";
import { assertLocale } from "@/i18n/locale";
import { requestClock } from "@/lib/today";
import { getSuppliersBySlugs, getWorkspace } from "@/server/catalog";
import { DataError } from "@/server/catalog-types";

const supplierTypes = ["MANUFACTURER", "DISTRIBUTOR", "FARM", "IMPORTER", "PACKAGING", "WHOLESALER", "OTHER"] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const locale = assertLocale((await params).locale);
  try {
    const jar = await cookies();
    const slugs = parseCompareSlugs(jar.get(compareCookieName)?.value);
    if (!slugs.length) {
      return new Response("No suppliers selected", { status: 400 });
    }
    const stored = parseMatchContext(jar.get(matchContextCookieName)?.value);
    const clock = await requestClock();
    const [suppliers, workspace, compare, catalog, freshness] = await Promise.all([
      getSuppliersBySlugs(slugs),
      getWorkspace(),
      getTranslations({ locale, namespace: "Compare" }),
      getTranslations({ locale, namespace: "Catalog" }),
      getTranslations({ locale, namespace: "Freshness" }),
    ]);
    if (!suppliers.length) {
      return new Response("No suppliers selected", { status: 400 });
    }

    const labels: ComparisonExportLabels = {
      columns: Object.fromEntries(comparisonExportColumns.map((column) => [column, compare(`exportColumns.${column}`)])) as ComparisonExportLabels["columns"],
      missing: catalog("unavailable"),
      supplierType: Object.fromEntries(supplierTypes.map((type) => [type, catalog(`types.${type}`)])) as ComparisonExportLabels["supplierType"],
      productType: Object.fromEntries(productTypes.map((type) => [type, catalog(`productTypes.${type}`)])) as ComparisonExportLabels["productType"],
      contactStatus: Object.fromEntries(contactStatuses.map((status) => [status, catalog(`contactStatus.${status}`)])) as ComparisonExportLabels["contactStatus"],
      freshness: Object.fromEntries(freshnessStatuses.map((status) => [status, freshness(status)])) as ComparisonExportLabels["freshness"],
    };
    const csv = buildComparisonCsv({
      suppliers,
      workspace,
      context: {
        query: stored.query || undefined,
        category: stored.category || undefined,
        city: stored.city || undefined,
        region: stored.region || undefined,
        maxPrice: stored.maxPrice,
        maxMoq: stored.maxMoq,
        certified: stored.certified,
      },
      labels,
      locale,
      now: new Date(clock.observedAt),
      timeZone: clock.timeZone,
    });
    const filename = comparisonExportFilename(clock.today);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (!(error instanceof DataError)) throw error;
    return new Response("Export failed", { status: 500 });
  }
}
