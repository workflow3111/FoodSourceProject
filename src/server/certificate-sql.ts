import { Prisma } from "@/generated/prisma/client";
import { certificateThresholds } from "@/lib/certificate-status";

/** Same rules as resolveCertificateStatus. The threshold comes from certificateThresholds. */
export function effectiveCertificateStatusSql(timeZone: string) {
  const days = certificateThresholds.expiringSoonDays;
  return Prisma.sql`
    CASE
      WHEN cert."certificateStatus"::text IN ('SUSPENDED', 'REVOKED') THEN cert."certificateStatus"::text
      WHEN cert."expiresAt" IS NULL THEN
        CASE WHEN cert."certificateStatus"::text = 'EXPIRED' THEN 'EXPIRED' ELSE 'UNKNOWN' END
      WHEN ((cert."expiresAt" AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone})::date
           < (CURRENT_TIMESTAMP AT TIME ZONE ${timeZone})::date THEN 'EXPIRED'
      WHEN ((cert."expiresAt" AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone})::date
           <= (CURRENT_TIMESTAMP AT TIME ZONE ${timeZone})::date + ${days}::integer THEN 'EXPIRING_SOON'
      ELSE 'VALID'
    END
  `;
}
