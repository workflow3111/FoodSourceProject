import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState, ErrorState, PageIntro, PanelSkeleton } from "@/components/catalog/chrome";
import { SupplierBadges } from "@/components/catalog/badges";
import { SupplierLogo } from "@/components/catalog/catalog-media";
import { FavoriteButton } from "@/components/catalog/supplier-actions";
import { ContactTracking, NoteEditor } from "@/components/catalog/workspace-forms";
import { Link } from "@/i18n/navigation";
import { assertLocale } from "@/i18n/locale";
import { contactStatuses, isContactStatus, isOverdueFollowUp } from "@/lib/contact-tracking";
import { formatCalendarDate, formatMoney } from "@/lib/format";
import { requestCalendarToday } from "@/lib/today";
import { getCatalog, getWorkspace } from "@/server/catalog";
import { DataError } from "@/server/catalog-types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Favorites" });
  return { title: t("title") };
}

export default async function FavoritesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = assertLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("Favorites");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <PageIntro title={t("title")} description={t("description")} />
      <Suspense fallback={<PanelSkeleton />}>
        <FavoriteList locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FavoriteList({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("Favorites");
  const catalog = await getTranslations("Catalog");
  const requested = (await searchParams).contact;
  const contact = typeof requested === "string" && isContactStatus(requested) ? requested : "";
  const [saved, today] = await Promise.all([loadFavorites(), requestCalendarToday()]);

  if (!saved) {
    return <ErrorState title={t("errorTitle")} text={t("errorText")} action={t("retry")} />;
  }

  if (!saved.length) {
      return (
        <EmptyState
          title={t("emptyTitle")}
          text={t("emptyText")}
          href="/suppliers"
          action={t("emptyAction")}
        />
      );
    }

    const visible = contact ? saved.filter((item) => item.entry.contactStatus === contact) : saved;

    return (
      <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label={t("filter")}>
        <FilterLink href="/favorites" active={contact === ""}>
          {t("anyStatus")}
        </FilterLink>
        {contactStatuses.map((status) => (
          <FilterLink key={status} href={`/favorites?contact=${status}`} active={contact === status}>
            {catalog(`contactStatus.${status}`)}
          </FilterLink>
        ))}
      </nav>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("filterEmpty")}</p>
      ) : null}
      <ul className="space-y-4">
        {visible.map(({ supplier, entry }) => (
          <li key={supplier.id} className={`rounded-xl border bg-card p-4 ${isOverdueFollowUp(entry.nextFollowUpOn, today) ? "border-amber-300" : ""}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <SupplierLogo
                  supplier={supplier}
                  size={48}
                  demoAlt={catalog("logoAlt", { name: supplier.name })}
                  realAlt={catalog("logoAltReal", { name: supplier.name })}
                  missingAlt={catalog("logoMissing", { name: supplier.name })}
                />
                <div className="min-w-0">
                <SupplierBadges supplier={supplier} />
                <h2 className="mt-3 text-base font-semibold">
                  <Link href={`/suppliers/${supplier.slug}`} className="hover:text-primary">
                    {supplier.name}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[supplier.city, supplier.region].filter(Boolean).join(", ")}
                  {supplier.minPrice == null
                    ? ""
                    : ` · ${catalog("priceFrom", { value: formatMoney(supplier.minPrice, locale) })}`}
                </p>
                {entry.nextFollowUpOn ? (
                  <p className={`mt-1 text-xs ${isOverdueFollowUp(entry.nextFollowUpOn, today) ? "font-medium text-amber-800" : "text-muted-foreground"}`}>
                    {catalog("followUp")}: {formatCalendarDate(entry.nextFollowUpOn, locale)}
                    {isOverdueFollowUp(entry.nextFollowUpOn, today) ? ` · ${catalog("overdue")}` : ""}
                  </p>
                ) : null}
                </div>
              </div>
              <FavoriteButton supplierId={supplier.id} saved />
            </div>
            <div className="mt-4 space-y-4 border-t pt-4">
              <ContactTracking supplierId={supplier.id} entry={entry} today={today} locale={locale} />
              <div className="space-y-3">
                <h3 className="text-sm font-medium">{t("notes")}</h3>
                {entry.notes.map((note) => (
                  <NoteEditor key={note.id} supplierId={supplier.id} note={note} />
                ))}
                <NoteEditor supplierId={supplier.id} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      </div>
    );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
      aria-current={active ? "true" : undefined}
    >
      {children}
    </Link>
  );
}

async function loadFavorites() {
  try {
    const [suppliers, workspace] = await Promise.all([getCatalog(), getWorkspace()]);
    return workspace.flatMap((entry) => {
      const supplier = suppliers.find((item) => item.id === entry.supplierId);
      return supplier ? [{ supplier, entry }] : [];
    });
  } catch (error) {
    if (!(error instanceof DataError)) throw error;
    return null;
  }
}
