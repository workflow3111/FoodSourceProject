import assert from "node:assert/strict";
import { certificateVerificationStatuses } from "@/lib/certificate-status";
import { applyCertificateVerification, applyRecordedCertificateStatus } from "./certificate-verification";

const now = new Date("2026-11-02T00:00:00.000Z");
const current = {
  verificationStatus: "UNVERIFIED" as const,
  verificationNotes: null,
  verifiedAt: null,
  verifiedBy: null,
};
const admin = { role: "administrator", name: "Проверяющий" };

for (const status of certificateVerificationStatuses) {
  assert.equal(applyCertificateVerification(current, { verificationStatus: status }, null, now).ok, false);
  assert.equal(
    applyCertificateVerification(current, { verificationStatus: status }, { role: "buyer", name: "Покупатель" }, now).ok,
    false,
  );
  assert.equal(
    applyCertificateVerification(current, { verificationStatus: status }, { role: "administrator", name: "  " }, now).ok,
    false,
  );
}

const verified = applyCertificateVerification(current, { verificationStatus: "VERIFIED", verificationNotes: "Сверено с файлом" }, admin, now);
assert.equal(verified.ok, true);
if (verified.ok) {
  assert.equal(verified.record.verificationStatus, "VERIFIED");
  assert.equal(verified.record.verifiedBy, "Проверяющий");
  assert.equal(verified.record.verifiedAt, now);
  assert.equal(verified.record.verificationNotes, "Сверено с файлом");
}

const rejected = applyCertificateVerification(current, { verificationStatus: "REJECTED" }, admin, now);
assert.equal(rejected.ok, true);
if (rejected.ok) {
  assert.equal(rejected.record.verificationStatus, "REJECTED");
  assert.equal(rejected.record.verifiedBy, "Проверяющий");
}

const pending = applyCertificateVerification(
  { ...current, verificationStatus: "VERIFIED", verifiedAt: now, verifiedBy: "Проверяющий" },
  { verificationStatus: "PENDING" },
  admin,
  now,
);
assert.equal(pending.ok, true);
if (pending.ok) {
  assert.equal(pending.record.verifiedAt, null);
  assert.equal(pending.record.verifiedBy, null);
}

assert.equal(
  applyCertificateVerification(current, { verificationStatus: "VERIFIED", verificationNotes: "x".repeat(2001) }, admin, now).ok,
  false,
);
assert.equal(applyCertificateVerification(current, { verificationStatus: "APPROVED" }, admin, now).ok, false);

const recorded = applyRecordedCertificateStatus("SUSPENDED", admin);
assert.equal(recorded.ok, true);
if (recorded.ok) assert.equal(recorded.certificateStatus, "SUSPENDED");
assert.equal(applyRecordedCertificateStatus("REVOKED", null).ok, false);
assert.equal(applyRecordedCertificateStatus("VALID", { role: "buyer", name: "Покупатель" }).ok, false);
