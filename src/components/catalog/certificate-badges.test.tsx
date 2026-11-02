import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { CertificateFacts, CertificateStatusBadge, VerificationStatusBadge } from "./certificate-badges";
import { certificateStatuses, certificateVerificationStatuses } from "@/lib/certificate-status";
import type { CatalogCertification } from "@/server/catalog-types";

const ru = JSON.parse(readFileSync(new URL("../../../messages/ru.json", import.meta.url), "utf8"));

function render(node: ReactNode) {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, { locale: "ru", messages: ru, timeZone: "UTC", children: node }),
  );
}

const labels = {
  VALID: "Действителен",
  EXPIRING_SOON: "Срок истекает",
  EXPIRED: "Истёк",
  SUSPENDED: "Приостановлен",
  REVOKED: "Отозван",
  UNKNOWN: "Неизвестно",
};
const verificationLabels = {
  UNVERIFIED: "Не проверен",
  PENDING: "Проверка выполняется",
  VERIFIED: "Проверен",
  REJECTED: "Отклонён",
};

for (const status of certificateStatuses) {
  const html = render(createElement(CertificateStatusBadge, { status }));
  assert.match(html, new RegExp(labels[status]));
  assert.match(html, /data-slot="badge"/);
}

for (const status of certificateVerificationStatuses) {
  const html = render(createElement(VerificationStatusBadge, { status }));
  assert.match(html, new RegExp(verificationLabels[status]));
}

const item: CatalogCertification = {
  id: "cert",
  name: "Демо: ХАССП",
  certificateNumber: null,
  documentUrl: null,
  sourceUrl: null,
  issuer: "Демонстрационный орган",
  recordedStatus: "VALID",
  certificateStatus: "VALID",
  verificationStatus: "UNVERIFIED",
  verifiedAt: null,
  verifiedBy: null,
  verificationNotes: "Запись вымышлена.",
  issuedAt: null,
  expiresAt: "2027-03-01T00:00:00.000Z",
  isDemo: true,
};

const detail = render(createElement(CertificateFacts, { item, locale: "ru", timeZone: "UTC" }));
assert.match(detail, /Демо: ХАССП/);
assert.match(detail, /Действителен/);
assert.match(detail, /Не проверен/);
assert.match(detail, /Демонстрационные данные/);
assert.match(detail, /Документ не приложен/);
assert.match(detail, /Запись вымышлена/);
assert.doesNotMatch(detail, /Проверен</);

const comparison = render(createElement(CertificateFacts, { item, locale: "ru", timeZone: "UTC", compact: true }));
assert.match(comparison, /Действует до/);
assert.doesNotMatch(comparison, /Документ не приложен/);

const missingDate = render(
  createElement(CertificateFacts, {
    item: { ...item, expiresAt: null, certificateStatus: "UNKNOWN", isDemo: false },
    locale: "ru",
    timeZone: "UTC",
    compact: true,
  }),
);
assert.match(missingDate, /Неизвестно/);
assert.match(missingDate, /Не указано/);
