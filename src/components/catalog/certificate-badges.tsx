"use client";

import { Badge } from "@/components/ui/badge";
import {
  isConfirmedCertificate,
  type CertificateStatus,
  type CertificateVerificationStatus,
} from "@/lib/certificate-status";
import { calendarDateInZone } from "@/lib/freshness";
import { formatCalendarDate } from "@/lib/format";
import type { CatalogCertification } from "@/server/catalog-types";
import { useTranslations } from "next-intl";

const certificateVariant = {
  VALID: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "destructive",
  SUSPENDED: "caution",
  REVOKED: "destructive",
  UNKNOWN: "secondary",
} as const;

const verificationVariant = {
  UNVERIFIED: "secondary",
  PENDING: "info",
  VERIFIED: "success",
  REJECTED: "destructive",
} as const;

export function CertificateStatusBadge({ status }: { status: CertificateStatus }) {
  const t = useTranslations("Catalog");
  return <Badge variant={certificateVariant[status]}>{t(`certificateStatus.${status}`)}</Badge>;
}

export function VerificationStatusBadge({ status }: { status: CertificateVerificationStatus }) {
  const t = useTranslations("Catalog");
  return <Badge variant={verificationVariant[status]}>{t(`certificateVerification.${status}`)}</Badge>;
}

export function CertificateSummary({
  certifications,
  align = "end",
}: {
  certifications: CatalogCertification[];
  align?: "start" | "end";
}) {
  const t = useTranslations("Catalog");
  if (certifications.length === 0) {
    return <span className="text-sm text-muted-foreground">{t("noCerts")}</span>;
  }

  const verified = certifications.filter((item) => !item.isDemo && isConfirmedCertificate(item)).length;
  const hasUnverified = certifications.some((item) => item.isDemo || item.verificationStatus !== "VERIFIED");
  const severe = severeStatus(certifications.map((item) => item.certificateStatus));

  return (
    <div className={`flex max-w-64 flex-col gap-1 ${align === "end" ? "items-end" : "items-start"}`}>
      <p className={`text-xs text-muted-foreground ${align === "end" ? "text-right" : ""}`}>
        {t("certificateVerifiedCount", { verified, total: certifications.length })}
      </p>
      <div className={`flex flex-wrap gap-1 ${align === "end" ? "justify-end" : "justify-start"}`}>
        {verified > 0 ? <VerificationStatusBadge status="VERIFIED" /> : null}
        {hasUnverified ? <VerificationStatusBadge status="UNVERIFIED" /> : null}
        {severe ? <CertificateStatusBadge status={severe} /> : null}
      </div>
    </div>
  );
}

export function CertificateFacts({
  item,
  locale,
  timeZone,
  compact = false,
}: {
  item: CatalogCertification;
  locale: string;
  timeZone: string;
  compact?: boolean;
}) {
  const t = useTranslations("Catalog");
  const profile = useTranslations("Profile");
  const expires = calendarLabel(item.expiresAt, locale, timeZone);
  const issued = calendarLabel(item.issuedAt, locale, timeZone);
  const verified = calendarLabel(item.verifiedAt, locale, timeZone);
  const expiryLabel = item.certificateStatus === "EXPIRED" && expires ? t("certificateExpiredOn") : t("certificateExpires");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{item.name}</p>
        {item.isDemo ? <span className="text-xs text-amber-800">{t("demo")}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <CertificateStatusBadge status={item.certificateStatus} />
        <VerificationStatusBadge status={item.verificationStatus} />
      </div>
      {item.certificateNumber ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("certificateNumber")}: {item.certificateNumber}
        </p>
      ) : null}
      {item.issuer ? <p className="mt-1 text-xs text-muted-foreground">{item.issuer}</p> : null}
      <p className="mt-2 text-xs leading-5">
        <span className="text-muted-foreground">{expiryLabel}: </span>
        {expires ?? t("unavailable")}
      </p>
      {compact ? null : (
        <>
          <p className="mt-1 text-xs leading-5">
            <span className="text-muted-foreground">{t("certificateIssued")}: </span>
            {issued ?? t("unavailable")}
          </p>
          <p className="mt-1 text-xs leading-5">
            <span className="text-muted-foreground">{t("certificateVerifiedOn")}: </span>
            {verified ? `${verified}${item.verifiedBy ? `, ${item.verifiedBy}` : ""}` : t("unavailable")}
          </p>
          {item.verificationNotes ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.verificationNotes}</p> : null}
          <p className="mt-2 text-xs leading-5">
            {item.documentUrl ? (
              <>
                <span className="text-muted-foreground">{profile("document")}: </span>
                <a href={item.documentUrl} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                  {item.documentUrl}
                </a>
              </>
            ) : (
              <span className="text-muted-foreground">{profile("noDocument")}</span>
            )}
          </p>
          {item.sourceUrl ? (
            <p className="mt-1 text-xs leading-5">
              <span className="text-muted-foreground">{profile("source")}: </span>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                {item.sourceUrl}
              </a>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

const severeOrder = ["REVOKED", "EXPIRED", "SUSPENDED", "EXPIRING_SOON"] as const;

function severeStatus(statuses: CertificateStatus[]) {
  return severeOrder.find((status) => statuses.includes(status)) ?? null;
}

function calendarLabel(value: string | null, locale: string, timeZone: string) {
  if (!value) return null;
  const day = calendarDateInZone(new Date(value), timeZone);
  return day ? formatCalendarDate(day, locale) : null;
}
