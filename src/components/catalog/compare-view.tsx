import { CertificateFacts } from "@/components/catalog/certificate-badges";
import { CompareProductList } from "@/components/catalog/product-type-ui";
import { SupplierLogo } from "@/components/catalog/catalog-media";
import { FavoriteButton } from "@/components/catalog/supplier-actions";
import { ContactStatusForm, NoteEditor } from "@/components/catalog/workspace-forms";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { compareLimit } from "@/lib/comparison";
import { formatMoney, formatQuantity } from "@/lib/format";
import type { CatalogSupplier, WorkspaceEntry } from "@/server/catalog-types";
import { matchSuppliers, type FactorStatus, type MatchContext, type MatchReport } from "@/server/matching";
import { removeFromComparison } from "@/server/actions";
import { getTranslations } from "next-intl/server";
import { Info, MapPin, Percent, Plus, ShieldCheck, X, type LucideIcon } from "lucide-react";

const columnTones = [
  { badge: "bg-emerald-600 text-white", bar: "bg-emerald-500", score: "text-emerald-700" },
  { badge: "bg-sky-500 text-white", bar: "bg-sky-500", score: "text-sky-700" },
  { badge: "bg-violet-500 text-white", bar: "bg-violet-500", score: "text-violet-700" },
] as const;

type Cell = {
  text: string;
  best: boolean;
  note?: string;
  noteTone?: "positive" | "caution" | "neutral";
  status?: FactorStatus;
  points?: number | null;
  statusLabel?: string;
};
type Row = { key: string; label: string; cells: Cell[] };

export async function CompareView({
  suppliers,
  workspace,
  locale,
  timeZone,
  context,
}: {
  suppliers: CatalogSupplier[];
  workspace: WorkspaceEntry[];
  locale: string;
  timeZone: string;
  context?: MatchContext;
}) {
  const t = await getTranslations("Compare");
  const catalog = await getTranslations("Catalog");
  const profile = await getTranslations("Profile");
  const reports = matchSuppliers(suppliers, context);
  const rows = buildRows(suppliers, reports, locale, catalog, t);
  const byId = new Map(reports.map((report) => [report.supplierId, report]));
  const savedIds = new Set(workspace.map((entry) => entry.supplierId));

  return (
    <div className="space-y-4">
      <GuideCards suppliers={suppliers} context={context} locale={locale} t={t} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {suppliers.map((supplier, index) => (
          <SupplierSummary
            key={supplier.id}
            supplier={supplier}
            index={index}
            report={byId.get(supplier.id)}
            saved={savedIds.has(supplier.id)}
            unavailable={catalog("unavailable")}
            demo={catalog("demo")}
            verification={catalog(`verification.${supplier.verificationStatus}`)}
            catalog={catalog}
            t={t}
          />
        ))}
        <AddSupplierSlot label={t("addSupplier")} hint={t("addSupplierLimit", { count: compareLimit })} enabled={suppliers.length < compareLimit} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-44 px-4 py-3 text-left font-medium text-muted-foreground">{t("criteria")}</th>
              {suppliers.map((supplier, index) => {
                const tone = columnTones[index] ?? columnTones[0];
                return (
                  <th key={supplier.id} className="min-w-52 px-4 py-3 text-left align-top">
                    <div className="flex items-center gap-2">
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${tone.badge}`}>
                        {index + 1}
                      </span>
                      <SupplierLogo
                        supplier={supplier}
                        size={36}
                        demoAlt={catalog("logoAlt", { name: supplier.name })}
                        realAlt={catalog("logoAltReal", { name: supplier.name })}
                        missingAlt={catalog("logoMissing", { name: supplier.name })}
                      />
                      <Link href={`/suppliers/${supplier.slug}`} className="font-semibold hover:text-primary">
                        {supplier.name}
                      </Link>
                    </div>
                    <div className="mt-2 max-w-36">
                      <ScoreFigure
                        score={byId.get(supplier.id)?.score ?? null}
                        barClass={tone.bar}
                        numberClass={tone.score}
                        unavailable={catalog("scoreUnavailable")}
                        compact
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b last:border-b-0">
                <th className="px-4 py-3 text-left align-top font-medium text-muted-foreground">{row.label}</th>
                {row.cells.map((cell, index) => (
                  <td key={`${row.key}-${suppliers[index]?.id}`} className="px-4 py-3 align-top">
                    {row.key === "products" ? (
                      <>
                        <CompareProductList products={suppliers[index]?.products ?? []} locale={locale} />
                        <CellBody cell={{ ...cell, text: suppliers[index]?.products.length ? "" : cell.text }} />
                      </>
                    ) : row.key === "verification" ? (
                      <VerificationCell supplier={suppliers[index]} label={cell.text} />
                    ) : row.key === "certs" ? (
                      <CertificateCompareCell
                        supplier={suppliers[index]}
                        locale={locale}
                        timeZone={timeZone}
                        cell={cell}
                        missing={catalog("noCerts")}
                      />
                    ) : (
                      <CellBody cell={cell} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DecisionList
        suppliers={suppliers}
        workspace={workspace}
        decision={t("decision")}
        websiteLabel={t("website")}
        sourceLabel={t("source")}
        unavailable={catalog("unavailable")}
        catalog={catalog}
        saveFirst={profile("saveFirst")}
      />
    </div>
  );
}

function CertificateCompareCell({
  supplier,
  locale,
  timeZone,
  cell,
  missing,
}: {
  supplier: CatalogSupplier;
  locale: string;
  timeZone: string;
  cell: Cell;
  missing: string;
}) {
  return (
    <>
      {supplier.certifications.length ? (
        <ul className="space-y-3">
          {supplier.certifications.map((item) => (
            <li key={item.id}>
              <CertificateFacts item={item} locale={locale} timeZone={timeZone} compact />
            </li>
          ))}
        </ul>
      ) : (
        <p>{missing}</p>
      )}
      <CellBody cell={cell} />
    </>
  );
}

function CellBody({ cell }: { cell: Cell }) {
  const noteClass =
    cell.noteTone === "caution"
      ? "mt-1 text-xs font-medium text-amber-950"
      : cell.noteTone === "positive"
        ? "mt-1 text-xs font-medium text-primary"
        : "mt-1 text-xs leading-5 text-muted-foreground";

  return (
    <>
      {cell.text ? <div className="whitespace-pre-line">{cell.text}</div> : null}
      {cell.status && cell.statusLabel ? (
        <div className="mt-1">
          <FactorChip status={cell.status} points={cell.points ?? null} label={cell.statusLabel} />
        </div>
      ) : null}
      {cell.note ? <p className={noteClass}>{cell.note}</p> : null}
    </>
  );
}

function FactorChip({
  status,
  points,
  label,
}: {
  status: FactorStatus;
  points: number | null;
  label: string;
}) {
  const tone =
    status === "scored"
      ? points
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-border bg-muted text-muted-foreground"
      : status === "not_comparable"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : status === "not_requested"
          ? "border-dashed border-border bg-background text-muted-foreground"
          : "border-border bg-background text-muted-foreground";

  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}

function geographyReason(
  report: MatchReport | undefined,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  const reason = report?.factors.find((factor) => factor.key === "geography")?.reason;
  return reason ? t(`reasons.${reason}`) : undefined;
}

function categoryName(suppliers: CatalogSupplier[], slug: string, locale: string) {
  for (const supplier of suppliers) {
    const product = supplier.products.find((item) => item.categorySlug === slug);
    if (product) return locale === "en" ? product.categoryNameEn : product.categoryNameRu;
  }
  return slug;
}

function RemoveForm({ slug, label }: { slug: string; label: string }) {
  return (
    <form action={removeFromComparison}>
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" variant="ghost" size="icon-sm" aria-label={label}>
        <X />
      </Button>
    </form>
  );
}

function buildRows(
  suppliers: CatalogSupplier[],
  reports: MatchReport[],
  locale: string,
  catalog: Awaited<ReturnType<typeof getTranslations>>,
  t: Awaited<ReturnType<typeof getTranslations>>,
): Row[] {
  const byId = new Map(reports.map((report) => [report.supplierId, report]));
  const categoryKey = locale === "en" ? "categoryNameEn" : "categoryNameRu";
  const unavailable = catalog("unavailable");
  const statusFor = (supplierId: string, key: MatchReport["factors"][number]["key"]) => {
    const factor = byId.get(supplierId)?.factors.find((item) => item.key === key);
    if (!factor) return {};
    const statusLabel =
      factor.status === "scored"
        ? (factor.points ?? 0) > 0
          ? t("comparable")
          : t("points", { points: factor.points ?? 0 })
        : t(`status.${factor.status}`);
    return { status: factor.status, points: factor.points, statusLabel };
  };

  return [
    {
      key: "products",
      label: t("products"),
      cells: suppliers.map((supplier) => {
        const reason = byId.get(supplier.id)?.factors.find((factor) => factor.key === "product")?.reason;
        return {
          text:
            supplier.products
              .slice(0, 4)
              .map((product) => `${product.name} · ${product[categoryKey]}`)
              .join("\n") || unavailable,
          best: false,
          note: reason ? t(`reasons.${reason}`) : undefined,
          noteTone: "neutral",
          ...statusFor(supplier.id, "product"),
        };
      }),
    },
    {
      key: "location",
      label: t("location"),
      cells: suppliers.map((supplier) => ({
        text: (() => {
          const place = [supplier.city, supplier.region].filter(Boolean).join(", ");
          return place ? [place, supplier.country].filter(Boolean).join(", ") : unavailable;
        })(),
        best: false,
        note: geographyReason(byId.get(supplier.id), t),
        noteTone: "neutral",
        ...statusFor(supplier.id, "geography"),
      })),
    },
    {
      key: "price",
      label: t("price"),
      cells: suppliers.map((supplier) => {
        const price = byId.get(supplier.id)?.price;
        return {
          text:
            price?.amount == null
              ? catalog("priceUnavailable")
              : `${formatMoney(price.amount, locale, price.currency ?? "RUB")}${price.unit ? ` / ${price.unit}` : ""}`,
          best: Boolean(price?.lowest),
          note: price?.lowest ? t("lowerPrice") : undefined,
          noteTone: price?.lowest ? "positive" : undefined,
          ...statusFor(supplier.id, "price"),
        };
      }),
    },
    {
      key: "moq",
      label: t("moq"),
      cells: suppliers.map((supplier) => {
        const moq = byId.get(supplier.id)?.moq;
        return {
          text: moq?.amount == null ? catalog("moqUnavailable") : formatQuantity(moq.amount, moq.unit, locale),
          best: Boolean(moq?.lowest),
          note: moq?.lowest ? t("lowerMoq") : undefined,
          noteTone: moq?.lowest ? "positive" : undefined,
          ...statusFor(supplier.id, "moq"),
        };
      }),
    },
    {
      key: "certs",
      label: t("certs"),
      cells: suppliers.map((supplier) => {
        const report = byId.get(supplier.id);
        const counted = (report?.verifiedCertifications ?? 0) > 0;
        return {
          text: "",
          best: false,
          note: supplier.certifications.length && !counted ? t("unverifiedCert") : undefined,
          noteTone: supplier.certifications.length && !counted ? "caution" : undefined,
          ...statusFor(supplier.id, "certification"),
        };
      }),
    },
    {
      key: "delivery",
      label: t("delivery"),
      cells: suppliers.map((supplier) => {
        const notes = [
          ...new Set(supplier.products.flatMap((product) => (product.deliveryNotes ? [product.deliveryNotes] : []))),
        ];
        return {
          text: notes.join("\n") || catalog("deliveryUnavailable"),
          best: false,
          note: notes.length ? t("deliveryUnverified") : undefined,
          noteTone: notes.length ? "caution" : undefined,
        };
      }),
    },
    {
      key: "coverage",
      label: t("coverageRow"),
      cells: suppliers.map((supplier) => {
        const reason = byId.get(supplier.id)?.factors.find((factor) => factor.key === "delivery")?.reason;
        return {
          text: reason ? t(`reasons.${reason}`) : unavailable,
          best: false,
          ...statusFor(supplier.id, "delivery"),
        };
      }),
    },
    {
      key: "verification",
      label: t("verification"),
      cells: suppliers.map((supplier) => ({
        text: `${catalog(`verification.${supplier.verificationStatus}`)}${supplier.dataType === "DEMO" ? `\n${catalog("demo")}` : ""}`,
        best: false,
      })),
    },
  ];
}

function GuideCards({
  suppliers,
  context,
  locale,
  t,
}: {
  suppliers: CatalogSupplier[];
  context?: MatchContext;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const category = context?.category ? categoryName(suppliers, context.category, locale) : "";
  const details = [
    context?.query ? t("basisQuery", { query: context.query }) : "",
    category ? t("basisCategory", { category }) : "",
    context?.city ? t("basisCity", { city: context.city }) : "",
    context?.region ? t("basisRegion", { region: context.region }) : "",
  ].filter(Boolean);
  const cards: { id: string; icon: LucideIcon; tone: string; title: string; body: string }[] = [
    { id: "score", icon: ShieldCheck, tone: "bg-emerald-50 text-emerald-700", title: t("guideScore"), body: t("disclaimer") },
    { id: "check", icon: Info, tone: "bg-violet-50 text-violet-700", title: t("guideCheck"), body: t("legend") },
    { id: "rank", icon: Percent, tone: "bg-sky-50 text-sky-700", title: t("guideRank"), body: t("statusLegend") },
    {
      id: "place",
      icon: MapPin,
      tone: "bg-amber-50 text-amber-700",
      title: t("guidePlace"),
      body: details.length ? t("basisFromSearch") : t("basisAmongSelection"),
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className={`flex size-7 items-center justify-center rounded-full ${card.tone}`}>
                <Icon className="size-3.5" />
              </span>
              <h2 className="text-sm font-medium">{card.title}</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.body}</p>
            {card.id === "place" && details.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {details.map((detail) => (
                  <li key={detail} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                    {detail}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function SupplierSummary({
  supplier,
  index,
  report,
  saved,
  unavailable,
  demo,
  verification,
  catalog,
  t,
}: {
  supplier: CatalogSupplier;
  index: number;
  report: MatchReport | undefined;
  saved: boolean;
  unavailable: string;
  demo: string;
  verification: string;
  catalog: Awaited<ReturnType<typeof getTranslations>>;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const tone = columnTones[index] ?? columnTones[0];
  const { advantage, weakest } = factorExtremes(report);
  const thin = report == null || report.score == null || report.coverage < 0.5;

  return (
    <article className="flex flex-col rounded-xl border bg-card p-4">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${tone.badge}`}>
          {index + 1}
        </span>
        <SupplierLogo
          supplier={supplier}
          size={40}
          demoAlt={catalog("logoAlt", { name: supplier.name })}
          realAlt={catalog("logoAltReal", { name: supplier.name })}
          missingAlt={catalog("logoMissing", { name: supplier.name })}
        />
        <h2 className="min-w-0 flex-1 text-sm font-semibold">
          <Link href={`/suppliers/${supplier.slug}`} className="hover:text-primary">
            {supplier.name}
          </Link>
        </h2>
        <FavoriteButton supplierId={supplier.id} saved={saved} appearance="icon" />
        <RemoveForm slug={supplier.slug} label={t("remove")} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {supplier.dataType === "DEMO" ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
            {demo}
          </span>
        ) : null}
        {thin ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{t("insufficient")}</span>
        ) : null}
      </div>
      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground" title={t("disclaimer")}>
        {t("score")}
        <Info className="size-3.5" />
      </p>
      <ScoreFigure
        score={report?.score ?? null}
        barClass={tone.bar}
        numberClass={tone.score}
        unavailable={unavailable}
      />
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t("keyAdvantage")}</dt>
          <dd className="mt-0.5 font-medium">{advantage ? t(`factors.${advantage.key}`) : unavailable}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("weakest")}</dt>
          <dd className="mt-0.5 font-medium">{weakest ? t(`factors.${weakest.key}`) : unavailable}</dd>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3">
          <dt className="text-xs text-muted-foreground">{t("reliability")}</dt>
          <dd className="flex items-center gap-1.5 text-right font-medium">
            {verification}
            <span className={`size-2 rounded-full ${verificationDot(supplier.verificationStatus)}`} />
          </dd>
        </div>
      </dl>
    </article>
  );
}

function AddSupplierSlot({ label, hint, enabled }: { label: string; hint: string; enabled: boolean }) {
  const className =
    "flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card px-4 text-center text-sm font-medium";
  if (!enabled) {
    return (
      <div className={`${className} text-muted-foreground`} aria-disabled="true">
        <Plus className="size-5" />
        {label}
        <span className="text-xs font-normal">{hint}</span>
      </div>
    );
  }
  return (
    <Link href="/suppliers" className={`${className} hover:bg-accent`}>
      <Plus className="size-5" />
      {label}
      <span className="text-xs font-normal text-muted-foreground">{hint}</span>
    </Link>
  );
}

function ScoreFigure({
  score,
  barClass,
  numberClass,
  unavailable,
  compact = false,
}: {
  score: number | null;
  barClass: string;
  numberClass: string;
  unavailable: string;
  compact?: boolean;
}) {
  if (score == null) {
    return <p className="text-sm text-muted-foreground">{unavailable}</p>;
  }
  return (
    <div>
      <p className={`${compact ? "text-sm" : "text-3xl"} font-semibold tracking-tight ${numberClass}`}>
        {score}
        <span className={`${compact ? "text-xs" : "text-base"} font-medium text-muted-foreground`}> /100</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}

function VerificationCell({ supplier, label }: { supplier: CatalogSupplier | undefined; label: string }) {
  if (!supplier) return null;
  const [status, extra] = label.split("\n");
  return (
    <div>
      <p className="flex items-center gap-1.5">
        <span className={`size-2 shrink-0 rounded-full ${verificationDot(supplier.verificationStatus)}`} />
        {status}
      </p>
      {extra ? <p className="mt-1 text-xs text-muted-foreground">{extra}</p> : null}
    </div>
  );
}

function verificationDot(status: CatalogSupplier["verificationStatus"]) {
  if (status === "VERIFIED") return "bg-emerald-500";
  if (status === "PARTIALLY_VERIFIED" || status === "EXPIRED") return "bg-amber-400";
  return "bg-red-500";
}

function factorExtremes(report: MatchReport | undefined) {
  if (!report) return { advantage: null, weakest: null };
  const scored = report.factors.filter((factor) => factor.status === "scored" && factor.points != null);
  const advantage = scored
    .filter((factor) => (factor.points ?? 0) > 0)
    .sort((left, right) => (right.points ?? 0) - (left.points ?? 0))[0] ?? null;
  const weakest =
    [...scored]
      .filter((factor) => factor.key !== advantage?.key && (factor.ratio ?? 1) < 1)
      .sort((left, right) => (left.ratio ?? 0) - (right.ratio ?? 0) || (left.points ?? 0) - (right.points ?? 0))[0] ??
    null;
  return { advantage, weakest };
}

function DecisionList({
  suppliers,
  workspace,
  decision,
  websiteLabel,
  sourceLabel,
  unavailable,
  catalog,
  saveFirst,
}: {
  suppliers: CatalogSupplier[];
  workspace: WorkspaceEntry[];
  decision: string;
  websiteLabel: string;
  sourceLabel: string;
  unavailable: string;
  catalog: Awaited<ReturnType<typeof getTranslations>>;
  saveFirst: string;
}) {
  const bySupplier = new Map(workspace.map((entry) => [entry.supplierId, entry]));

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{decision}</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {suppliers.map((supplier, index) => {
          const entry = bySupplier.get(supplier.id) ?? null;
          const source = supplier.sources[0];
          const sourceUrl = source?.url ?? supplier.sourceUrl;
          const tone = columnTones[index] ?? columnTones[0];
          return (
            <article key={supplier.id} className="space-y-3 rounded-xl border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-md text-xs ${tone.badge}`}>
                  {index + 1}
                </span>
                <SupplierLogo
                  supplier={supplier}
                  size={36}
                  demoAlt={catalog("logoAlt", { name: supplier.name })}
                  realAlt={catalog("logoAltReal", { name: supplier.name })}
                  missingAlt={catalog("logoMissing", { name: supplier.name })}
                />
                <Link href={`/suppliers/${supplier.slug}`} className="hover:text-primary">
                  {supplier.name}
                </Link>
              </h3>
              <div className="flex flex-wrap gap-2">
                <FavoriteButton supplierId={supplier.id} saved={entry != null} appearance="bookmark" />
                {supplier.website ? (
                  <a href={supplier.website} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-sm font-medium hover:bg-accent">
                    {websiteLabel}
                  </a>
                ) : (
                  <span className="inline-flex h-8 items-center text-sm text-muted-foreground">{websiteLabel}: {unavailable}</span>
                )}
              </div>
              <div className="text-sm">
                <p className="text-xs text-muted-foreground">{sourceLabel}</p>
                {sourceUrl ? (
                  <a href={sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                    {source?.title ?? sourceUrl}
                  </a>
                ) : (
                  <p className="text-muted-foreground">{unavailable}</p>
                )}
              </div>
              {entry ? (
                <div className="space-y-3">
                  <ContactStatusForm supplierId={supplier.id} status={entry.contactStatus} />
                  {entry.notes.map((note) => (
                    <NoteEditor key={note.id} supplierId={supplier.id} note={note} />
                  ))}
                  <NoteEditor supplierId={supplier.id} />
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">{saveFirst}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
