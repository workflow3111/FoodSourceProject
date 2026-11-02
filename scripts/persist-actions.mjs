import { config } from "dotenv";
import pg from "pg";
import { createSupplier, deleteSupplier } from "../src/server/supplier-records.ts";

config();

const base = "http://127.0.0.1:3000";
const slug = "proverka-sohraneniya";
const noteText = "Проверка сохранения заметки";
const failures = [];

function check(name, condition) {
  if (!condition) failures.push(name);
  else console.log(`ok ${name}`);
}

function decode(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
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
    const textarea = chunk.match(/<textarea\b([^>]*)>/i);
    return { html: chunk, fields, textareaName: textarea ? attr(textarea[1], "name") : "" };
  });
}

function withField(fields, name, value) {
  return [...fields.filter(([key]) => key !== name), [name, value]];
}

async function getHtml(path, cookie = "") {
  const response = await fetch(base + path, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${path} ${response.status} ${text.slice(0, 240)}`);
  }
  return text;
}

async function postForm(path, fields) {
  const body = new FormData();
  for (const [name, value] of fields) body.append(name, value);
  const response = await fetch(base + path, {
    method: "POST",
    body,
    redirect: "manual",
    headers: {
      Origin: base,
      Referer: base + path,
    },
  });
  const text = await response.text();
  const cookie = (response.headers.getSetCookie?.() ?? []).map((item) => item.split(";")[0]).join("; ");
  return { status: response.status, text, cookie };
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const db = new pg.Client({ connectionString });
await db.connect();

let supplierId = null;

try {
  const existing = await db.query(`SELECT "id" FROM "Supplier" WHERE "slug" = $1`, [slug]);
  if (existing.rows[0]) await deleteSupplier(existing.rows[0].id);

  const created = await createSupplier({
    name: "ДЕМО — Проверка сохранения",
    slug,
    description: "Временная запись для проверки сохранения. Демонстрационные данные.",
    supplierType: "OTHER",
    city: "Казань",
    region: "Республика Татарстан",
    address: null,
    website: "https://example.com/demo/proverka-sohraneniya",
    sourceUrl: "https://example.com/demo/proverka-sohraneniya",
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
  check("profile renders the created supplier", profile.includes("Проверка сохранения"));

  const favorite = parseForms(profile).find(
    (form) => /избран/i.test(form.html) && form.fields.some(([name]) => name === "supplierId"),
  );
  const savedPost = await postForm(`/suppliers/${slug}`, favorite.fields);
  const saved = await db.query(
    `SELECT "contactStatus" FROM "Shortlist" WHERE "supplierId" = $1 AND "workspaceKey" = 'demo-workspace'`,
    [supplierId],
  );
  check(
    "favorite action creates a shortlist row",
    saved.rowCount === 1 && saved.rows[0].contactStatus === "NOT_CONTACTED" && savedPost.status < 400,
  );

  const withNotes = await getHtml(`/suppliers/${slug}`);
  const noteForm = parseForms(withNotes).find((form) => form.textareaName === "content");
  const notePost = noteForm
    ? await postForm(`/suppliers/${slug}`, withField(noteForm.fields, "content", noteText))
    : { status: 0 };
  const note = await db.query(
    `SELECT "content" FROM "SupplierNote" WHERE "supplierId" = $1 AND "workspaceKey" = 'demo-workspace'`,
    [supplierId],
  );
  check("note action stores the text", note.rows.some((row) => row.content === noteText) && notePost.status < 400);

  const statusForm = parseForms(withNotes).find((form) => form.html.includes('name="status"'));
  const statusPost = statusForm
    ? await postForm(`/suppliers/${slug}`, withField(statusForm.fields, "status", "QUALIFIED"))
    : { status: 0 };
  const status = await db.query(`SELECT "contactStatus" FROM "Shortlist" WHERE "supplierId" = $1`, [supplierId]);
  check(
    "contact status action updates the row",
    status.rows[0]?.contactStatus === "QUALIFIED" && statusPost.status < 400,
  );

  const noted = await getHtml(`/suppliers/${slug}`);
  const deleteForm = parseForms(noted).find(
    (form) =>
      form.fields.some(([name]) => name === "noteId") && !form.fields.some(([name]) => name === "supplierId"),
  );
  const deletePost = deleteForm ? await postForm(`/suppliers/${slug}`, deleteForm.fields) : { status: 0 };
  const remaining = await db.query(
    `SELECT "id" FROM "SupplierNote" WHERE "supplierId" = $1 AND "content" = $2`,
    [supplierId, noteText],
  );
  check("delete note action removes the row", remaining.rowCount === 0 && deletePost.status < 400);

  const compareForm = parseForms(profile).find((form) => form.fields.some(([name, value]) => name === "slug" && value === slug));
  const comparePost = await postForm(
    `/suppliers/${slug}`,
    withField(
      withField(
        withField(withField(withField(compareForm.fields, "rememberContext", "1"), "q", ""), "category", ""),
        "city",
        "Москва",
      ),
      "region",
      "",
    ),
  );
  const compared = comparePost.cookie ? await getHtml("/compare", comparePost.cookie) : "";
  check(
    "comparison action keeps the supplier and the search city",
    comparePost.cookie.includes(`fs-compare=${slug}`) &&
      comparePost.cookie.includes("fs-match") &&
      compared.includes("Местоположение не совпадает с запросом.") &&
      compared.includes("/ kg"),
  );

  const unsavedPage = await getHtml(`/suppliers/${slug}`);
  const unsave = parseForms(unsavedPage).find(
    (form) => /избран/i.test(form.html) && form.fields.some(([name]) => name === "supplierId"),
  );
  const unsavePost = await postForm(`/suppliers/${slug}`, unsave.fields);
  const gone = await db.query(
    `SELECT s."id" AS shortlist, n."id" AS note
     FROM "Supplier" supplier
     LEFT JOIN "Shortlist" s ON s."supplierId" = supplier."id" AND s."workspaceKey" = 'demo-workspace'
     LEFT JOIN "SupplierNote" n ON n."supplierId" = supplier."id" AND n."workspaceKey" = 'demo-workspace'
     WHERE supplier."id" = $1`,
    [supplierId],
  );
  check(
    "removing the favorite deletes the shortlist and its notes",
    unsavePost.status < 400 && gone.rows.every((row) => row.shortlist == null && row.note == null),
  );

  const afterRemoval = await getHtml(`/suppliers/${slug}`);
  const noteWithoutSave = parseForms(afterRemoval).find((form) => form.textareaName === "content");
  const directNote = "Заметка без предварительного сохранения";
  const directPost = noteWithoutSave
    ? await postForm(`/suppliers/${slug}`, withField(noteWithoutSave.fields, "content", directNote))
    : { status: 0 };
  const directRows = await db.query(
    `SELECT s."id" AS shortlist, n."content" AS content
     FROM "Supplier" supplier
     LEFT JOIN "Shortlist" s ON s."supplierId" = supplier."id" AND s."workspaceKey" = 'demo-workspace'
     LEFT JOIN "SupplierNote" n ON n."supplierId" = supplier."id" AND n."workspaceKey" = 'demo-workspace'
     WHERE supplier."id" = $1`,
    [supplierId],
  );
  check(
    "a note saves the supplier and stores the text",
    directPost.status < 400 &&
      directRows.rows.some((row) => row.shortlist != null && row.content === directNote),
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

console.log("persistence checks passed");
