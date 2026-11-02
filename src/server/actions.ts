"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { demoWorkspaceKey } from "@/config/site";
import {
  compareCookieName,
  compareLimit,
  matchContextCookieName,
  parseCompareSlugs,
  parseMatchContext,
} from "@/lib/comparison";
import { calendarToday, isContactMethod, isContactStatus, parseContactDate } from "@/lib/contact-tracking";
import { getPrisma } from "@/lib/prisma";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const idSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);
const contactPersonSchema = z.string().trim().max(120);

export type FavoriteState = { ok: true; saved: boolean } | { ok: false; error: "invalid" | "missing" };
export type CompareState =
  | { ok: true; comparing: boolean }
  | { ok: false; error: "full" | "invalid" | "missing" };
export type NoteState = { ok: true } | { ok: false; error: "invalid" | "empty" | "missing" };
export type StatusState = { ok: true } | { ok: false; error: "invalid" | "missing" };

function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/en", "layout");
}

async function readCompareCookie() {
  const jar = await cookies();
  return parseCompareSlugs(jar.get(compareCookieName)?.value);
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

async function writeCompareCookie(slugs: string[]) {
  const jar = await cookies();
  jar.set(compareCookieName, slugs.join(","), { ...cookieOptions, httpOnly: false });
}

async function rememberMatchContext(formData: FormData) {
  if (formData.get("rememberContext") !== "1") return;
  const context = parseMatchContext(
    JSON.stringify({
      query: String(formData.get("q") ?? ""),
      category: String(formData.get("category") ?? ""),
      city: String(formData.get("city") ?? ""),
      region: String(formData.get("region") ?? ""),
      maxPrice: String(formData.get("maxPrice") ?? ""),
      maxMoq: String(formData.get("maxMoq") ?? ""),
      certified: formData.get("certified") === "1",
    }),
  );
  const jar = await cookies();
  jar.set(matchContextCookieName, JSON.stringify(context), cookieOptions);
}

export async function toggleFavorite(
  _previous: FavoriteState | null,
  formData: FormData,
): Promise<FavoriteState> {
  const supplierId = idSchema.safeParse(String(formData.get("supplierId") ?? ""));
  if (!supplierId.success) {
    return { ok: false, error: "invalid" };
  }

  const prisma = getPrisma();
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId.data },
    select: { id: true },
  });
  if (!supplier) {
    return { ok: false, error: "missing" };
  }

  const where = {
    workspaceKey_supplierId: {
      workspaceKey: demoWorkspaceKey,
      supplierId: supplier.id,
    },
  };
  const existing = await prisma.shortlist.findUnique({ where });

  if (existing) {
    await prisma.supplierNote.deleteMany({
      where: { workspaceKey: demoWorkspaceKey, supplierId: supplier.id },
    });
    await prisma.shortlist.delete({ where: { id: existing.id } });
    refresh();
    return { ok: true, saved: false };
  }

  await prisma.shortlist.create({
    data: { workspaceKey: demoWorkspaceKey, supplierId: supplier.id },
  });
  refresh();
  return { ok: true, saved: true };
}

export async function addToComparison(
  _previous: CompareState | null,
  formData: FormData,
): Promise<CompareState> {
  const slug = slugSchema.safeParse(String(formData.get("slug") ?? ""));
  if (!slug.success) {
    return { ok: false, error: "invalid" };
  }

  const supplier = await getPrisma().supplier.findUnique({
    where: { slug: slug.data },
    select: { slug: true },
  });
  if (!supplier) {
    return { ok: false, error: "missing" };
  }

  const current = await readCompareCookie();
  if (current.includes(supplier.slug)) {
    await rememberMatchContext(formData);
    refresh();
    return { ok: true, comparing: true };
  }
  if (current.length >= compareLimit) {
    return { ok: false, error: "full" };
  }

  await writeCompareCookie([...current, supplier.slug]);
  await rememberMatchContext(formData);
  refresh();
  return { ok: true, comparing: true };
}

export async function removeFromComparison(formData: FormData) {
  const slug = slugSchema.safeParse(String(formData.get("slug") ?? ""));
  if (!slug.success) {
    return;
  }

  const current = await readCompareCookie();
  await writeCompareCookie(current.filter((item) => item !== slug.data));
  refresh();
}

export async function saveNote(
  _previous: NoteState | null,
  formData: FormData,
): Promise<NoteState> {
  const supplierId = idSchema.safeParse(String(formData.get("supplierId") ?? ""));
  const noteId = String(formData.get("noteId") ?? "");
  const content = String(formData.get("content") ?? "").trim();

  if (!supplierId.success) {
    return { ok: false, error: "invalid" };
  }
  if (!content || content.length > 2000) {
    return { ok: false, error: "empty" };
  }

  const prisma = getPrisma();
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId.data },
    select: { id: true },
  });
  if (!supplier) {
    return { ok: false, error: "missing" };
  }

  const shortlistKey = {
    workspaceKey_supplierId: {
      workspaceKey: demoWorkspaceKey,
      supplierId: supplier.id,
    },
  };

  if (noteId) {
    const parsedId = idSchema.safeParse(noteId);
    if (!parsedId.success) {
      return { ok: false, error: "invalid" };
    }
    const note = await prisma.supplierNote.findFirst({
      where: {
        id: parsedId.data,
        workspaceKey: demoWorkspaceKey,
        supplierId: supplierId.data,
      },
    });
    if (!note) {
      return { ok: false, error: "missing" };
    }
    await prisma.supplierNote.update({
      where: { id: note.id },
      data: { content },
    });
  } else {
    await prisma.$transaction([
      prisma.shortlist.upsert({
        where: shortlistKey,
        create: { workspaceKey: demoWorkspaceKey, supplierId: supplier.id },
        update: {},
      }),
      prisma.supplierNote.create({
        data: {
          workspaceKey: demoWorkspaceKey,
          supplierId: supplier.id,
          content,
        },
      }),
    ]);
  }

  refresh();
  return { ok: true };
}

export async function deleteNote(formData: FormData) {
  const noteId = idSchema.safeParse(String(formData.get("noteId") ?? ""));
  if (!noteId.success) {
    return;
  }

  await getPrisma().supplierNote.deleteMany({
    where: { id: noteId.data, workspaceKey: demoWorkspaceKey },
  });
  refresh();
}

export async function updateContactStatus(
  _previous: StatusState | null,
  formData: FormData,
): Promise<StatusState> {
  const supplierId = idSchema.safeParse(String(formData.get("supplierId") ?? ""));
  const statusText = String(formData.get("status") ?? "");
  if (!supplierId.success || !isContactStatus(statusText)) {
    return { ok: false, error: "invalid" };
  }

  const supplier = await getPrisma().supplier.findUnique({
    where: { id: supplierId.data },
    select: { id: true },
  });
  if (!supplier) return { ok: false, error: "missing" };

  const details = formData.get("details") === "1";
  const data: {
    contactStatus: typeof statusText;
    lastContactOn?: Date | null;
    nextFollowUpOn?: Date | null;
    contactPerson?: string | null;
    contactMethod?: "EMAIL" | "PHONE" | "WEBSITE" | "OTHER" | null;
  } = { contactStatus: statusText };

  if (details) {
    const person = contactPersonSchema.safeParse(String(formData.get("contactPerson") ?? ""));
    const last = parseContactDate(String(formData.get("lastContactOn") ?? ""));
    const next = parseContactDate(String(formData.get("nextFollowUpOn") ?? ""));
    const methodText = String(formData.get("contactMethod") ?? "").trim();
    if (!person.success || !last.ok || !next.ok) return { ok: false, error: "invalid" };
    if (methodText && !isContactMethod(methodText)) return { ok: false, error: "invalid" };
    if (last.date && last.date > calendarToday()) return { ok: false, error: "invalid" };
    data.lastContactOn = last.date ? new Date(`${last.date}T00:00:00.000Z`) : null;
    data.nextFollowUpOn = next.date ? new Date(`${next.date}T00:00:00.000Z`) : null;
    data.contactPerson = person.data || null;
    data.contactMethod = methodText && isContactMethod(methodText) ? methodText : null;
  }

  await getPrisma().shortlist.upsert({
    where: {
      workspaceKey_supplierId: { workspaceKey: demoWorkspaceKey, supplierId: supplier.id },
    },
    create: { workspaceKey: demoWorkspaceKey, supplierId: supplier.id, ...data },
    update: data,
  });

  refresh();
  return { ok: true };
}
