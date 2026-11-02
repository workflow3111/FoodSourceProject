"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { factorGrade, leadingReason, matchQuality, type MatchQuality, type MatchReport } from "@/server/matching";

export function MatchScore({
  report,
  basis,
}: {
  report: MatchReport | null;
  basis?: "search" | "catalog";
}) {
  const t = useTranslations("Catalog");
  const compare = useTranslations("Compare");
  const header = useTranslations("Header");
  const [open, setOpen] = useState(false);
  const quality = matchQuality(report ?? { score: null, coverage: 0 });
  const reason = report ? leadingReason(report) : null;
  const coverage = Math.round((report?.coverage ?? 0) * 100);
  const score = report?.score ?? null;
  const filled = score == null ? 0 : Math.max(0, Math.min(100, score));

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <section className="rounded-xl border bg-card p-4" aria-label={t("matchingTitle")}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold">{t("matchingTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("coverageLabeled", { percent: coverage })}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className={score == null ? "text-lg font-semibold text-muted-foreground" : "text-3xl font-semibold tracking-tight text-primary"}>
            {score == null ? t("scoreUnavailable") : t("scoreRatio", { score })}
          </p>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${qualityClass(quality)}`}>
            {t(`quality.${quality}`)}
          </span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
          role={score == null ? undefined : "meter"}
          aria-valuemin={score == null ? undefined : 0}
          aria-valuemax={score == null ? undefined : 100}
          aria-valuenow={score == null ? undefined : filled}
          aria-label={score == null ? undefined : t("matchingTitle")}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${filled}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("criteriaLine")}</p>
          <Dialog.Trigger className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline">
            {t("viewDetails")}
            <ChevronRight className="size-4" />
          </Dialog.Trigger>
        </div>
      </section>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(40rem,calc(100%-2rem))] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-card shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold">{t("breakdown")}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {score == null ? t("scoreUnavailable") : t("score", { score })}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={header("close")}>
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-5 py-4">
            {reason ? <p className="text-sm leading-6">{compare(`reasons.${reason}`)}</p> : null}
            {report && score != null && report.coverage < 0.5 ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("coverageLimit")}</p>
            ) : null}
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("scoreDisclaimer")}</p>
            {basis ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t(basis === "catalog" ? "scoreBasisCatalog" : "scoreBasisSearch")}
              </p>
            ) : null}
            {report ? (
              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                {report.factors.map((factor) => {
                  const grade = factorGrade(factor);
                  return (
                    <div key={factor.key} className="rounded-lg border px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-sm font-medium">{compare(`factors.${factor.key}`)}</dt>
                        <dd className={`text-xs font-medium ${gradeTone(grade)}`}>{t(`grade.${grade}`)}</dd>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{compare(`reasons.${factor.reason}`)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {factor.points == null ? compare("excluded") : compare("points", { points: factor.points })}
                      </p>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">{t("scoreUnavailable")}</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function qualityClass(quality: MatchQuality) {
  if (quality === "strong") return "bg-primary text-primary-foreground";
  if (quality === "partial") return "bg-amber-600 text-white";
  return quality === "weak" ? "bg-muted text-muted-foreground" : "border text-muted-foreground";
}

function gradeTone(grade: ReturnType<typeof factorGrade>) {
  if (grade === "exact") return "text-emerald-700";
  if (grade === "partial") return "text-amber-700";
  if (grade === "mismatch") return "text-red-700";
  return "text-muted-foreground";
}
