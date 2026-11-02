export const contactStatuses = [
  "NOT_CONTACTED",
  "CONTACTED",
  "AWAITING_RESPONSE",
  "RESPONDED",
  "NEGOTIATING",
  "QUALIFIED",
  "REJECTED",
] as const;

export const contactMethods = ["EMAIL", "PHONE", "WEBSITE", "OTHER"] as const;

export type ContactStatus = (typeof contactStatuses)[number];
export type ContactMethod = (typeof contactMethods)[number];

export function isContactStatus(value: string): value is ContactStatus {
  return contactStatuses.some((status) => status === value);
}

export function isContactMethod(value: string): value is ContactMethod {
  return contactMethods.some((method) => method === value);
}

/** Empty text is a cleared date. A returned null means the text is not a real calendar date. */
export function parseContactDate(value: string): { ok: true; date: string | null } | { ok: false } {
  const text = value.trim();
  if (!text) return { ok: true, date: null };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return { ok: false };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100) return { ok: false };
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false };
  }
  return { ok: true, date: text };
}

export function isOverdueFollowUp(followUp: string | null, today: string) {
  return Boolean(followUp && today && followUp < today);
}

export function calendarToday(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
