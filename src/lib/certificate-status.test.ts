import assert from "node:assert/strict";
import {
  certificateStatuses,
  certificateThresholds,
  certificateVerificationStatuses,
  isConfirmedCertificate,
  resolveCertificateStatus,
} from "./certificate-status";

const zone = "UTC";
const today = new Date("2026-11-02T12:00:00.000Z");

function day(offset: number) {
  return new Date(Date.UTC(2026, 10, 2 + offset, 12));
}

assert.equal(certificateThresholds.expiringSoonDays, 30);
assert.equal(certificateStatuses.length, 6);
assert.equal(certificateVerificationStatuses.length, 4);

for (const status of certificateStatuses) {
  if (status === "SUSPENDED" || status === "REVOKED") {
    assert.equal(resolveCertificateStatus(status, day(-10), today, zone), status);
    assert.equal(resolveCertificateStatus(status, null, today, zone), status);
  }
}

assert.equal(resolveCertificateStatus("VALID", day(-1), today, zone), "EXPIRED");
assert.equal(resolveCertificateStatus("UNKNOWN", day(0), today, zone), "EXPIRING_SOON");
assert.equal(resolveCertificateStatus("VALID", day(30), today, zone), "EXPIRING_SOON");
assert.equal(resolveCertificateStatus("UNKNOWN", day(31), today, zone), "VALID");
assert.equal(resolveCertificateStatus("EXPIRED", day(90), today, zone), "VALID");
assert.equal(resolveCertificateStatus("VALID", null, today, zone), "UNKNOWN");
assert.equal(resolveCertificateStatus("EXPIRING_SOON", undefined, today, zone), "UNKNOWN");
assert.equal(resolveCertificateStatus("EXPIRED", null, today, zone), "EXPIRED");
assert.equal(resolveCertificateStatus("UNKNOWN", "not-a-date", today, zone), "UNKNOWN");

assert.equal(isConfirmedCertificate({ certificateStatus: "VALID", verificationStatus: "VERIFIED" }), true);
assert.equal(isConfirmedCertificate({ certificateStatus: "EXPIRING_SOON", verificationStatus: "VERIFIED" }), true);
assert.equal(isConfirmedCertificate({ certificateStatus: "VALID", verificationStatus: "UNVERIFIED" }), false);
assert.equal(isConfirmedCertificate({ certificateStatus: "VALID", verificationStatus: "PENDING" }), false);
assert.equal(isConfirmedCertificate({ certificateStatus: "EXPIRED", verificationStatus: "VERIFIED" }), false);
assert.equal(isConfirmedCertificate({ certificateStatus: "UNKNOWN", verificationStatus: "VERIFIED" }), false);
assert.equal(isConfirmedCertificate({ certificateStatus: "SUSPENDED", verificationStatus: "VERIFIED" }), false);
assert.equal(isConfirmedCertificate({ certificateStatus: "REVOKED", verificationStatus: "VERIFIED" }), false);
assert.equal(isConfirmedCertificate({ certificateStatus: "VALID", verificationStatus: "REJECTED" }), false);
