import { calendarDateInZone, calendarDaySpan, serverTimeZone } from "@/lib/freshness";

/** Change the expiring-soon window here. Search SQL uses the same number. */
export const certificateThresholds = {
  expiringSoonDays: 30,
} as const;

export const certificateStatuses = [
  "VALID",
  "EXPIRING_SOON",
  "EXPIRED",
  "SUSPENDED",
  "REVOKED",
  "UNKNOWN",
] as const;

export type CertificateStatus = (typeof certificateStatuses)[number];

export const certificateVerificationStatuses = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] as const;

export type CertificateVerificationStatus = (typeof certificateVerificationStatuses)[number];

export const certificateFilters = ["verified", "valid", "expiring", "expired", "unverified"] as const;

export type CertificateFilter = (typeof certificateFilters)[number];

const currentStatuses = new Set<CertificateStatus>(["VALID", "EXPIRING_SOON"]);
const authoritativeStatuses = new Set<CertificateStatus>(["SUSPENDED", "REVOKED"]);

export function isCertificateStatus(value: string): value is CertificateStatus {
  return certificateStatuses.some((status) => status === value);
}

export function isCertificateVerificationStatus(value: string): value is CertificateVerificationStatus {
  return certificateVerificationStatuses.some((status) => status === value);
}

export function isCertificateFilter(value: string): value is CertificateFilter {
  return certificateFilters.some((filter) => filter === value);
}

/**
 * Effective validity. Recalculated on every catalog read and in supplier search.
 * The database column is the recorded status and is not overwritten by this function.
 * SUSPENDED and REVOKED stay as recorded. A recorded EXPIRED with no date stays EXPIRED.
 * Any other recorded status follows the expiration date, or becomes UNKNOWN when that date is missing.
 */
export function resolveCertificateStatus(
  recorded: CertificateStatus,
  expiresAt: string | Date | null | undefined,
  now: Date,
  timeZone = serverTimeZone(),
): CertificateStatus {
  if (authoritativeStatuses.has(recorded)) return recorded;
  const expiry = calendarDay(expiresAt, timeZone);
  const today = calendarDateInZone(now, timeZone);
  if (!expiry || !today) return recorded === "EXPIRED" ? "EXPIRED" : "UNKNOWN";
  const daysUntil = calendarDaySpan(today, expiry);
  if (daysUntil == null) return "UNKNOWN";
  if (daysUntil < 0) return "EXPIRED";
  if (daysUntil <= certificateThresholds.expiringSoonDays) return "EXPIRING_SOON";
  return "VALID";
}

export function isConfirmedCertificate(certificate: {
  certificateStatus: CertificateStatus;
  verificationStatus: CertificateVerificationStatus;
}) {
  return certificate.verificationStatus === "VERIFIED" && currentStatuses.has(certificate.certificateStatus);
}

function calendarDay(value: string | Date | null | undefined, timeZone: string) {
  if (value == null || value === "") return null;
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return calendarDateInZone(instant, timeZone);
}
