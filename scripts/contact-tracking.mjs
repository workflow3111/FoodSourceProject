import { config } from "dotenv";
import pg from "pg";
import { isOverdueFollowUp, parseContactDate } from "../src/lib/contact-tracking.ts";
import { createSupplier, deleteSupplier } from "../src/server/supplier-records.ts";

config();

const base = "http://127.0.0.1:3000";
const slug = "proverka-kontakta";
const failures = [];

function check(name, condition) {
  if (!condition) failures.push(name);
  else console.log(`ok ${name}`);
}

check("rejects a calendar date that does not exist", parseContactDate("2026-02-31").ok === false);
check("clears an empty date", parseContactDate("  ").ok === true && parseContactDate("  ").date === null);
check("keeps a real date", parseContactDate("2026-10-01").ok === true && parseContactDate("2026-10-01").date === "2026-10-01");
check("a past follow-up is overdue", isOverdueFollowUp("2020-01-01", "2026-11-01"));
check("a later follow-up is not overdue", isOverdueFollowUp("2099-01-01", "2026-11-01") === false);

function decode(value) {
  return value.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? decode(match[1]) : "";
}

function parseForms(html) {
  return [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map((match) => {
    const chunk = match[0];
    const fields = [...chunk.matchAll(/<input\b[^>]*>/gi)]
      .map((input) => [attr(input[0], "name"), attr(input[0], "value")])
      .filter(([name]) => name);
    return { html: chunk, fields };
  });
}

function withField(fields, name, value) {
  return [...fields.filter(([key]) => key !== name), [name, value]];
}

async function getHtml(path) {
  const response = await fetch(base + path);
  const text = await response.text();
  if (!response.ok) throw new Error(`GET ${path} ${response.status}`);
  return text;
}

async function postForm(path, fields) {
  const body = new FormData();
  for (const [name, value] of fields) body.append(name, value);
  const response = await fetch(base + path, {
    method: "POST",
    body,
    redirect: "manual",
    headers: { Origin: base, Referer: base + path },
  });
  return response.status < 400;
}

const db = new pg.Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
await db.connect();
let supplierId = null;

try {
  const existing = await db.query(`SELECT "id" FROM "Supplier" WHERE "slug" = $1`, [slug]);
  if (existing.rows[0]) await deleteSupplier(existing.rows[0].id);
  const created = await createSupplier({
    name: "ДЕМО — Проверка контакта",
    slug,
    description: "Временная запись для проверки статуса контакта.",
    supplierType: "OTHER",
    city: "Казань",
    region: "Республика Татарстан",
    address: null,
    website: "https://example.com/demo/proverka-kontakta",
    sourceUrl: "https://example.com/demo/proverka-kontakta",
    dataType: "DEMO",
    products: [
      {
        name: "Пробный продукт",
        categorySlug: "grocery",
        productType: "INGREDIENTS",
        estimatedPrice: 10,
        minimumOrderQuantity: 4,
        unit: "кг",
        deliveryNotes: null,
      },
    ],
  });
  supplierId = created.id;

  const profile = await getHtml(`/suppliers/${slug}`);
  const tracking = parseForms(profile).find((form) => form.fields.some(([name, value]) => name === "details" && value === "1"));
  const posted = tracking
    ? await postForm(`/suppliers/${slug}`, withField(tracking.fields, "status", "CONTACTED"))
    : false;
  const first = await db.query(
    `SELECT "contactStatus"::text AS status, "lastContactOn"::text AS last FROM "Shortlist" WHERE "supplierId" = $1`,
    [supplierId],
  );
  check(
    "choosing contacted does not invent a last contact date",
    posted && first.rows[0]?.status === "CONTACTED" && first.rows[0]?.last == null,
  );

  const saved = tracking
    ? await postForm(
        `/suppliers/${slug}`,
        withField(
          withField(
            withField(
              withField(withField(tracking.fields, "status", "AWAITING_RESPONSE"), "lastContactOn", "2026-10-01"),
              "nextFollowUpOn",
              "2020-01-02",
            ),
            "contactPerson",
            "Анна",
          ),
          "contactMethod",
          "EMAIL",
        ),
      )
    : false;
  const row = await db.query(
    `SELECT "contactStatus"::text AS status, "lastContactOn"::text AS last, "nextFollowUpOn"::text AS next, "contactPerson" AS person, "contactMethod"::text AS method
     FROM "Shortlist" WHERE "supplierId" = $1`,
    [supplierId],
  );
  check(
    "contact details are stored",
    saved &&
      row.rows[0]?.status === "AWAITING_RESPONSE" &&
      row.rows[0]?.last === "2026-10-01" &&
      row.rows[0]?.next === "2020-01-02" &&
      row.rows[0]?.person === "Анна" &&
      row.rows[0]?.method === "EMAIL",
  );

  const invalidDate = tracking
    ? await postForm(
        `/suppliers/${slug}`,
        withField(withField(tracking.fields, "status", "RESPONDED"), "lastContactOn", "2026-02-31"),
      )
    : false;
  const future = tracking
    ? await postForm(
        `/suppliers/${slug}`,
        withField(withField(tracking.fields, "status", "RESPONDED"), "lastContactOn", "2099-01-01"),
      )
    : false;
  const invalidStatus = tracking
    ? await postForm(`/suppliers/${slug}`, withField(tracking.fields, "status", "BANANA"))
    : false;
  const unchanged = await db.query(
    `SELECT "contactStatus"::text AS status, "lastContactOn"::text AS last FROM "Shortlist" WHERE "supplierId" = $1`,
    [supplierId],
  );
  check(
    "invalid dates and statuses do not replace the stored contact",
    invalidDate && future && invalidStatus && unchanged.rows[0]?.status === "AWAITING_RESPONSE" && unchanged.rows[0]?.last === "2026-10-01",
  );

  const statusOnly = tracking
    ? await postForm(
        `/suppliers/${slug}`,
        withField(tracking.fields.filter(([name]) => name !== "details"), "status", "NEGOTIATING"),
      )
    : false;
  const kept = await db.query(
    `SELECT "contactStatus"::text AS status, "contactPerson" AS person, "lastContactOn"::text AS last FROM "Shortlist" WHERE "supplierId" = $1`,
    [supplierId],
  );
  check(
    "a status-only update keeps the contact details",
    statusOnly && kept.rows[0]?.status === "NEGOTIATING" && kept.rows[0]?.person === "Анна" && kept.rows[0]?.last === "2026-10-01",
  );

  const noted = await getHtml(`/suppliers/${slug}`);
  check(
    "stored follow-up is shown on the profile",
    noted.includes("2020") && (noted.includes("Срок следующего контакта прошёл") || noted.includes("Follow-up overdue")),
  );
} finally {
  if (supplierId) {
    await db.query(`DELETE FROM "SupplierNote" WHERE "supplierId" = $1`, [supplierId]);
    await db.query(`DELETE FROM "Shortlist" WHERE "supplierId" = $1`, [supplierId]);
    await deleteSupplier(supplierId);
  }
  await db.end();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("contact tracking checks passed");
