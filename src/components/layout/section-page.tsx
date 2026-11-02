import { getTranslations } from "next-intl/server";
import type { NavKey } from "@/config/navigation";
import type { AppLocale } from "@/i18n/routing";

export async function sectionMetadata(page: NavKey, locale: AppLocale) {
  const t = await getTranslations({
    locale,
    namespace: `Pages.${page}`,
  });

  return { title: t("title") };
}

export async function SectionPage({
  page,
  query,
}: {
  page: NavKey;
  query?: string;
}) {
  const t = await getTranslations(`Pages.${page}`);
  const trimmed = query?.trim();
  const body =
    page === "suppliers" && trimmed ? t("query", { query: trimmed }) : t("empty");

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
    </section>
  );
}

export function SectionFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="h-4 w-2/3 max-w-md animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
