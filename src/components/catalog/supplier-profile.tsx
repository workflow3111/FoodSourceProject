import { SupplierBadges } from "@/components/catalog/badges";
import { CertificateFacts, CertificateSummary } from "@/components/catalog/certificate-badges";
import { SupplierLogo } from "@/components/catalog/catalog-media";
import { FreshnessIndicator } from "@/components/catalog/freshness-indicator";
import { MatchScore } from "@/components/catalog/match-score";
import { CompareButton, FavoriteButton } from "@/components/catalog/supplier-actions";
import { moqLine, placeLine, priceLine } from "@/components/catalog/supplier-facts";
import { SupplierProductSection } from "@/components/catalog/product-type-ui";
import { SourceMenu } from "@/components/catalog/source-menu";
import {
  ContactTracking,
  NoteEditor,
} from "@/components/catalog/workspace-forms";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "cn";
import type { ProductType } from "@/lib/product-type";
import type { CatalogContact, CatalogSupplier, WorkspaceEntry } from "@/server/catalog-types";
import type { MatchReport } from "@/server/matching";
import { getTranslations } from "next-intl/server";
import {
  Building2,
  ChevronLeft,
  Coins,
  ExternalLink,
  Info,
  MapPin,
  Package,
  Phone,
  Shield,
  Star,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";

export async function SupplierProfile({
  supplier,
  locale,
  saved,
  comparing,
  workspace,
  report,
  listHref,
  matchContext,
  scoreBasis,
  today,
  observedAt,
  timeZone,
  productType = "",
}: {
  supplier: CatalogSupplier;
  locale: string;
  saved: boolean;
  comparing: boolean;
  workspace: WorkspaceEntry | null;
  report: MatchReport | null;
  listHref: string;
  scoreBasis: "search" | "catalog";
  today: string;
  observedAt: string;
  timeZone: string;
  productType?: ProductType | "";
  matchContext?: {
    query: string;
    category: string;
    city: string;
    region: string;
    maxPrice?: string;
    maxMoq?: string;
    certified?: boolean;
  };
}) {
  const t = await getTranslations("Profile");
  const catalog = await getTranslations("Catalog");
  const deliveryNotes = [
    ...new Set(supplier.products.flatMap((product) => (product.deliveryNotes ? [product.deliveryNotes] : []))),
  ];
  const place = [placeLine(supplier), supplier.country].filter(Boolean).join(", ");
  const price = priceLine(supplier, locale, (value) => catalog("priceFrom", { value }));
  const moq = moqLine(supplier, locale, (value) => catalog("moqFrom", { value }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <Link href={listHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        {t("back")}
      </Link>
      <div className="mt-4">
        <div className="flex min-w-0 items-start gap-4">
          <SupplierLogo
            supplier={supplier}
            size={64}
            demoAlt={catalog("logoAlt", { name: supplier.name })}
            realAlt={catalog("logoAltReal", { name: supplier.name })}
            missingAlt={catalog("logoMissing", { name: supplier.name })}
            demoMark={catalog("demoMark")}
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">{supplier.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0 text-primary" />
              <span>{place || catalog("unavailable")}</span>
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SupplierBadges supplier={supplier} variant="profile" />
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <FavoriteButton
            supplierId={supplier.id}
            saved={saved}
            appearance="bookmark"
            className="h-9 rounded-lg"
          />
          <CompareButton
            slug={supplier.slug}
            active={comparing}
            showIcon
            activeVariant="default"
            context={matchContext}
            className="h-9 rounded-lg"
          />
          {supplier.website ? (
            <a
              href={supplier.website}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-lg")}
            >
              {t("website")}
              <ExternalLink />
            </a>
          ) : (
            <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-lg text-muted-foreground")}>
              {t("website")}
            </span>
          )}
          <SourceMenu
            label={t("source")}
            className="h-9 rounded-lg"
            sources={supplier.sources.map((source) => ({
              id: source.id,
              url: source.url,
              title: source.title,
            }))}
          />
          </div>
        </div>
      </div>
      {supplier.description ? (
        <p className="mt-4 flex w-full items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-6">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>{supplier.description}</span>
        </p>
      ) : null}

      <dl className="mt-4 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x">
        <Metric
          icon={Coins}
          label={catalog("price")}
          caption={t("priceRange")}
          value={price.kind === "missing" ? catalog("priceUnavailable") : price.text}
          missing={price.kind === "missing"}
        />
        <Metric
          icon={Package}
          label={catalog("moq")}
          caption={t("minimumOrder")}
          value={moq.kind === "missing" ? catalog("moqUnavailable") : moq.text}
          missing={moq.kind === "missing"}
        />
        <div className="flex gap-3 lg:px-4">
          <Shield className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">{catalog("certifications")}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <CertificateSummary certifications={supplier.certifications} align="start" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("certCheck")}</p>
          </div>
        </div>
        <Metric
          icon={Truck}
          label={t("delivery")}
          caption={t("deliveryPromise")}
          value={deliveryNotes.length ? t("deliveryUnconfirmed") : catalog("deliveryUnavailable")}
          missing={!deliveryNotes.length}
          caution={deliveryNotes.length > 0}
        />
      </dl>

      <div className="mt-4">
        <MatchScore report={report} basis={scoreBasis} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <SupplierProductSection products={supplier.products} locale={locale} initialType={productType} />

          <section className="rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Truck className="size-4 text-muted-foreground" />
              {t("delivery")}
            </h2>
            {deliveryNotes.length ? (
              <>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  {deliveryNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-muted-foreground">{catalog("deliveryStated")}</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{catalog("deliveryUnavailable")}</p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Shield className="size-4 text-muted-foreground" />
              {catalog("certifications")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">{catalog("certificateNotProof")}</p>
            {supplier.dataType === "DEMO" && supplier.certifications.length ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700">
                <TriangleAlert className="size-4 shrink-0" />
                {catalog("demoCerts")}
              </p>
            ) : null}
            {supplier.certifications.length ? (
              <ul className="mt-3 space-y-3">
                {supplier.certifications.map((item) => (
                  <li key={item.id} className="rounded-lg border px-3 py-3">
                    <CertificateFacts item={item} locale={locale} timeZone={timeZone} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{catalog("noCerts")}</p>
            )}
          </section>

          <FreshnessIndicator
            supplier={supplier}
            locale={locale}
            observedAt={observedAt}
            timeZone={timeZone}
            variant="detail"
          />
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-4 text-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="size-4 text-muted-foreground" />
              {t("company")}
            </h2>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t("type")}</dt>
                <dd className="mt-0.5 font-medium">{catalog(`types.${supplier.supplierType}`)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("address")}</dt>
                <dd className={`mt-0.5 ${supplier.address ? "font-medium" : "text-muted-foreground"}`}>
                  {supplier.address ?? catalog("unavailable")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{catalog("verificationLabel")}</dt>
                <dd className="mt-0.5 font-medium">{catalog(`verification.${supplier.verificationStatus}`)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Phone className="size-4 text-muted-foreground" />
              {t("contacts")}
            </h2>
            {supplier.contacts.length ? (
              <ul className="mt-3 space-y-3 text-sm">
                {supplier.contacts.map((contact) => (
                  <li key={contact.id}>
                    <p className="text-xs text-muted-foreground">
                      {contact.label ?? catalog(`contactType.${contact.type}`)}
                    </p>
                    <ContactValue contact={contact} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{catalog("unavailable")}</p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Star className="size-4 text-muted-foreground" />
              {t("workspace")}
            </h2>
            <div className="mt-3 space-y-4">
              <ContactTracking supplierId={supplier.id} entry={workspace} today={today} locale={locale} />
              {workspace ? null : <p className="text-sm leading-6 text-muted-foreground">{t("saveFirst")}</p>}
              {workspace
                ? workspace.notes.map((note) => <NoteEditor key={note.id} supplierId={supplier.id} note={note} />)
                : null}
              <NoteEditor supplierId={supplier.id} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  caption,
  value,
  missing,
  caution = false,
}: {
  icon: LucideIcon;
  label: string;
  caption: string;
  value: string;
  missing: boolean;
  caution?: boolean;
}) {
  const valueClass = missing ? "text-muted-foreground" : caution ? "text-amber-600" : "";
  return (
    <div className="flex gap-3 lg:px-4 lg:first:pl-0 lg:last:pr-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={`mt-1 text-sm font-semibold ${valueClass}`}>{value}</dd>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

function ContactValue({ contact }: { contact: CatalogContact }) {
  if (contact.type === "EMAIL") {
    return (
      <a className="text-primary hover:underline" href={`mailto:${contact.value}`}>
        {contact.value}
      </a>
    );
  }
  if (contact.type === "PHONE") {
    return (
      <a className="text-primary hover:underline" href={`tel:${contact.value.replace(/[^\d+]/g, "")}`}>
        {contact.value}
      </a>
    );
  }
  if (/^https?:\/\//.test(contact.value)) {
    return (
      <a className="inline-flex items-center gap-1 text-primary hover:underline" href={contact.value} target="_blank" rel="noreferrer">
        {contact.value}
        <ExternalLink className="size-3.5" />
      </a>
    );
  }
  return <span>{contact.value}</span>;
}
