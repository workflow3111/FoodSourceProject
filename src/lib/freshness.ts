import type { CatalogSupplier } from "@/server/catalog-types";

/** Calendar-day ages for the supplier record update. Change these in this object only. */
export const freshnessThresholds = {
  freshDays: 30,
  agingDays: 90,
} as const;

export const freshnessStatuses = ["fresh", "aging", "stale", "unknown"] as const;

export type FreshnessStatus = (typeof freshnessStatuses)[number];

export type FreshnessFacts = {
  status: FreshnessStatus;
  createdAt: string | null;
  recordUpdatedAt: string | null;
  verifiedAt: string | null;
  /** No synchronization model is stored, so this is never inferred from another timestamp. */
  externalSyncedAt: null;
  sourceCheckedAt: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceType: CatalogSupplier["sources"][number]["sourceType"] | null;
};

export function isFreshnessStatus(value: string): value is FreshnessStatus {
  return freshnessStatuses.some((status) => status === value);
}

export function isTimeZone(timeZone: string) {
  if (!timeZone) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function serverTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isTimeZone(timeZone) ? timeZone : "UTC";
}

export function calendarDateInZone(instant: Date, timeZone: string) {
  if (Number.isNaN(instant.getTime())) return null;
  const zone = isTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function calendarDaySpan(earlier: string, later: string) {
  const start = /^(\d{4})-(\d{2})-(\d{2})$/.exec(earlier);
  const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(later);
  if (!start || !end) return null;
  const from = Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]));
  const to = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
  return Math.round((to - from) / 86_400_000);
}

/** Classifies the supplier record update. Verification and source-check dates are not inputs. */
export function freshnessStatus(
  recordUpdatedAt: string | Date | null | undefined,
  now: Date,
  timeZone: string,
): FreshnessStatus {
  const instant = recordUpdatedAt instanceof Date ? recordUpdatedAt : parseInstant(recordUpdatedAt);
  if (!instant || Number.isNaN(now.getTime())) return "unknown";
  const updatedDay = calendarDateInZone(instant, timeZone);
  const today = calendarDateInZone(now, timeZone);
  if (!updatedDay || !today) return "unknown";
  const age = calendarDaySpan(updatedDay, today);
  if (age == null || age < 0) return "unknown";
  if (age <= freshnessThresholds.freshDays) return "fresh";
  if (age <= freshnessThresholds.agingDays) return "aging";
  return "stale";
}

export function freshnessFacts(
  supplier: Pick<CatalogSupplier, "createdAt" | "updatedAt" | "lastVerifiedAt" | "sourceUrl" | "sources">,
  now: Date,
  timeZone: string,
): FreshnessFacts {
  const source = supplier.sources[0] ?? null;
  return {
    status: freshnessStatus(supplier.updatedAt, now, timeZone),
    createdAt: instantIso(supplier.createdAt),
    recordUpdatedAt: instantIso(supplier.updatedAt),
    verifiedAt: instantIso(supplier.lastVerifiedAt),
    externalSyncedAt: null,
    sourceCheckedAt: instantIso(source?.checkedAt),
    sourceUrl: source?.url ?? supplier.sourceUrl,
    sourceTitle: source?.title ?? null,
    sourceType: source?.sourceType ?? null,
  };
}

function parseInstant(value: string | null | undefined) {
  if (!value || !value.trim()) return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function instantIso(value: string | null | undefined) {
  return parseInstant(value)?.toISOString() ?? null;
}
