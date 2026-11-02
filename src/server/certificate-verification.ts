import {
  isCertificateStatus,
  isCertificateVerificationStatus,
  type CertificateStatus,
  type CertificateVerificationStatus,
} from "@/lib/certificate-status";

export type CertificateAdministrator = {
  role: string;
  name: string;
};

export type CertificateVerificationRecord = {
  verificationStatus: CertificateVerificationStatus;
  verificationNotes: string | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
};

const noteLimit = 2000;

export function applyCertificateVerification(
  current: CertificateVerificationRecord,
  input: {
    verificationStatus: string;
    verificationNotes?: string | null;
  },
  actor: CertificateAdministrator | null,
  now: Date,
): { ok: true; record: CertificateVerificationRecord } | { ok: false; error: "unauthorized" | "invalid" } {
  const administrator = authorizedAdministrator(actor);
  if (!administrator) return { ok: false, error: "unauthorized" };
  if (!isCertificateVerificationStatus(input.verificationStatus)) return { ok: false, error: "invalid" };

  const notes = normalizeNotes(input.verificationNotes, current.verificationNotes);
  if (notes === "invalid") return { ok: false, error: "invalid" };

  if (input.verificationStatus === "VERIFIED" || input.verificationStatus === "REJECTED") {
    return {
      ok: true,
      record: {
        verificationStatus: input.verificationStatus,
        verificationNotes: notes,
        verifiedAt: now,
        verifiedBy: administrator,
      },
    };
  }

  return {
    ok: true,
    record: {
      verificationStatus: input.verificationStatus,
      verificationNotes: notes,
      verifiedAt: null,
      verifiedBy: null,
    },
  };
}

export function applyRecordedCertificateStatus(
  next: string,
  actor: CertificateAdministrator | null,
): { ok: true; certificateStatus: CertificateStatus } | { ok: false; error: "unauthorized" | "invalid" } {
  if (!authorizedAdministrator(actor)) return { ok: false, error: "unauthorized" };
  if (!isCertificateStatus(next)) return { ok: false, error: "invalid" };
  return { ok: true, certificateStatus: next };
}

function authorizedAdministrator(actor: CertificateAdministrator | null) {
  if (!actor || actor.role !== "administrator") return null;
  const name = actor.name.trim();
  return name.length > 0 ? name : null;
}

function normalizeNotes(input: string | null | undefined, current: string | null) {
  if (input === undefined) return current;
  if (input == null) return null;
  const notes = input.trim();
  if (notes.length > noteLimit) return "invalid" as const;
  return notes.length ? notes : null;
}
