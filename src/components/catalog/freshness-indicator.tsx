import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { ExternalLink } from "lucide-react";
import { freshnessFacts, type FreshnessStatus } from "@/lib/freshness";
import type { CatalogSupplier } from "@/server/catalog-types";
import { getTranslations } from "next-intl/server";

const tones: Record<FreshnessStatus, string> = {
  fresh: "border-primary/30 bg-primary/10 text-primary",
  aging: "border-amber-200 bg-amber-50 text-amber-900",
  stale: "border-border bg-muted text-muted-foreground",
  unknown: "border-dashed text-muted-foreground",
};

export async function FreshnessIndicator({
  supplier,
  locale,
  observedAt,
  timeZone,
  variant,
}: {
  supplier: CatalogSupplier;
  locale: string;
  observedAt: string;
  timeZone: string;
  variant: "card" | "detail";
}) {
  const t = await getTranslations("Freshness");
  const catalog = await getTranslations("Catalog");
  const observed = new Date(observedAt);
  const facts = freshnessFacts(supplier, observed, timeZone);
  const unavailable = catalog("unavailable");
  const updated = dateText(facts.recordUpdatedAt, locale) ?? unavailable;
  const checked = dateText(facts.sourceCheckedAt, locale);

  if (variant === "card") {
    const confidence =
      supplier.verificationStatus === "VERIFIED" || supplier.verificationStatus === "PARTIALLY_VERIFIED"
        ? "font-medium text-primary"
        : supplier.verificationStatus === "EXPIRED"
          ? "font-medium text-amber-700"
          : "text-muted-foreground";
    return (
      <section className="mt-5 border-t pt-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t("sourceSection")}</h3>
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[facts.status]}`}>
            {t(facts.status)}
          </span>
        </div>
        <dl className="mt-3 space-y-2.5 text-sm">
          <SourceFact label={t("source")}>
            <SourceLine facts={facts} unavailable={unavailable} demoLabel={catalog("demoSource")} />
          </SourceFact>
          <SourceFact label={t("lastReviewed")}>{checked ?? unavailable}</SourceFact>
          <SourceFact label={t("confidence")}>
            <span className={confidence}>{catalog(`verification.${supplier.verificationStatus}`)}</span>
          </SourceFact>
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("sourceDisclaimer")}</p>
      </section>
    );
  }

  const reviewed = dateText(latestSourceCheck(supplier.sources), locale) ?? unavailable;
  const verificationTone =
    supplier.verificationStatus === "VERIFIED" || supplier.verificationStatus === "PARTIALLY_VERIFIED"
      ? "border-primary/30 bg-primary/10 text-primary"
      : supplier.verificationStatus === "EXPIRED"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-border text-muted-foreground";

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t("sourceSection")}</h2>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[facts.status]}`}>
          {t(facts.status)}
        </span>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <SourceFact label={t("lastUpdated")}>
          <span className="font-semibold">{updated}</span>
        </SourceFact>
        <SourceFact label={t("lastReviewed")}>
          <span className="font-semibold">{reviewed}</span>
        </SourceFact>
        <SourceFact label={t("verification")}>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${verificationTone}`}>
            {catalog(`verification.${supplier.verificationStatus}`)}
          </span>
        </SourceFact>
      </dl>
      <div className="mt-4 border-t pt-4">
        <h3 className="text-sm font-semibold">{t("informationSources")}</h3>
        {supplier.sources.length ? (
          <ul className="mt-2 divide-y">
            {supplier.sources.map((source) => (
              <li key={source.id}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-3 py-3 hover:text-primary"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{source.title ?? source.url}</span>
                    <span className={`mt-0.5 block text-xs ${source.sourceType === "DEMO" ? "text-amber-800" : "text-muted-foreground"}`}>
                      {t(`sourceTypes.${source.sourceType}`)}
                    </span>
                    {source.evidence ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{source.evidence}</span> : null}
                  </span>
                  <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{unavailable}</p>
        )}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("detailDisclaimer")}</p>
    </section>
  );
}

function SourceFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  );
}

function latestSourceCheck(sources: CatalogSupplier["sources"]) {
  const latest = sources.reduce<number | null>((current, source) => {
    if (!source.checkedAt) return current;
    const time = new Date(source.checkedAt).getTime();
    if (Number.isNaN(time)) return current;
    return current == null || time > current ? time : current;
  }, null);
  return latest == null ? null : new Date(latest).toISOString();
}

function SourceLine({
  facts,
  unavailable,
  demoLabel,
}: {
  facts: ReturnType<typeof freshnessFacts>;
  unavailable: string;
  demoLabel: string;
}) {
  if (!facts.sourceUrl && !facts.sourceTitle) return <span className="text-foreground">{unavailable}</span>;
  const label = facts.sourceTitle || facts.sourceUrl || unavailable;
  return (
    <span className="text-foreground">
      {facts.sourceUrl ? (
        <a href={facts.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
          {label}
        </a>
      ) : (
        label
      )}
      {facts.sourceType === "DEMO" ? <span className="mt-1 block text-xs text-amber-800">{demoLabel}</span> : null}
    </span>
  );
}

function dateText(iso: string | null, locale: string) {
  if (!iso) return null;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  return formatDate(iso, locale);
}
