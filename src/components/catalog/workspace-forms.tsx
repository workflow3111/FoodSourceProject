"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ContactStatus } from "@/generated/prisma/client";
import { contactMethods, contactStatuses, isOverdueFollowUp } from "@/lib/contact-tracking";
import { formatCalendarDate, formatDate } from "@/lib/format";
import { deleteNote, saveNote, updateContactStatus } from "@/server/actions";
import type { WorkspaceEntry, WorkspaceNote } from "@/server/catalog-types";

function PendingButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("Catalog");

  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? t("saving") : label}
    </Button>
  );
}

export function ContactStatusForm({
  supplierId,
  status,
}: {
  supplierId: string;
  status: ContactStatus;
}) {
  const t = useTranslations("Catalog");
  const [state, action, pending] = useActionState(updateContactStatus, null);

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="sr-only" htmlFor={`status-${supplierId}`}>
        {t("status")}
      </label>
      <select
        id={`status-${supplierId}`}
        name="status"
        defaultValue={status}
        className="h-9 w-full rounded-md border bg-card px-3 text-sm sm:max-w-xs"
      >
        {contactStatuses.map((item) => (
          <option key={item} value={item}>
            {t(`contactStatus.${item}`)}
          </option>
        ))}
      </select>
      <input type="hidden" name="supplierId" value={supplierId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? t("saving") : t("saveStatus")}
      </Button>
      {state?.ok ? <p className="text-xs text-primary">{t("statusSaved")}</p> : null}
      {state && !state.ok ? <p className="text-xs text-destructive">{t("actionFailed")}</p> : null}
    </form>
  );
}

export function ContactTracking({
  supplierId,
  entry,
  today,
  locale,
}: {
  supplierId: string;
  entry: WorkspaceEntry | null;
  today: string;
  locale: string;
}) {
  const t = useTranslations("Catalog");
  const [state, action, pending] = useActionState(updateContactStatus, null);
  const overdue = isOverdueFollowUp(entry?.nextFollowUpOn ?? null, today);
  const unavailable = t("unavailable");

  return (
    <div className="space-y-3">
      {overdue ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          {t("overdue")}
        </p>
      ) : null}
      <form action={action} className="space-y-3">
        <input type="hidden" name="supplierId" value={supplierId} />
        <input type="hidden" name="details" value="1" />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("status")}</span>
          <select
            name="status"
            defaultValue={entry?.contactStatus ?? "NOT_CONTACTED"}
            className="h-9 w-full rounded-md border bg-card px-3 text-sm"
          >
            {contactStatuses.map((item) => (
              <option key={item} value={item}>
                {t(`contactStatus.${item}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("lastContact")}</span>
            <input
              type="date"
              name="lastContactOn"
              defaultValue={entry?.lastContactOn ?? ""}
              className="h-9 w-full rounded-md border bg-card px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("followUp")}</span>
            <input
              type="date"
              name="nextFollowUpOn"
              defaultValue={entry?.nextFollowUpOn ?? ""}
              className="h-9 w-full rounded-md border bg-card px-3 text-sm"
            />
          </label>
        </div>
        <div className="grid gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("contactPerson")}</span>
            <input
              name="contactPerson"
              defaultValue={entry?.contactPerson ?? ""}
              maxLength={120}
              className="h-9 w-full rounded-md border bg-card px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("contactMethod")}</span>
            <select
              name="contactMethod"
              defaultValue={entry?.contactMethod ?? ""}
              className="h-9 w-full rounded-md border bg-card px-3 text-sm"
            >
              <option value="">{unavailable}</option>
              {contactMethods.map((method) => (
                <option key={method} value={method}>
                  {t(`contactMethodOption.${method}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t("saving") : t("saveStatus")}
        </Button>
        {state && !state.ok ? <p className="text-xs text-destructive">{t("actionFailed")}</p> : null}
        {state?.ok ? <p className="text-xs text-primary">{t("statusSaved")}</p> : null}
      </form>
      <div>
        <h3 className="text-sm font-medium">{t("activity")}</h3>
        <dl className="mt-2 space-y-2 text-sm">
          <Summary
            label={t("status")}
            value={t(`contactStatus.${entry?.contactStatus ?? "NOT_CONTACTED"}`)}
          />
          <Summary
            label={t("lastContact")}
            value={entry?.lastContactOn ? formatCalendarDate(entry.lastContactOn, locale) : unavailable}
            missing={!entry?.lastContactOn}
          />
          <Summary
            label={t("followUp")}
            value={entry?.nextFollowUpOn ? formatCalendarDate(entry.nextFollowUpOn, locale) : unavailable}
            missing={!entry?.nextFollowUpOn}
            caution={overdue}
          />
          <Summary label={t("contactPerson")} value={entry?.contactPerson || unavailable} missing={!entry?.contactPerson} />
          <Summary
            label={t("contactMethod")}
            value={entry?.contactMethod ? t(`contactMethodOption.${entry.contactMethod}`) : unavailable}
            missing={!entry?.contactMethod}
          />
          <Summary
            label={t("updated")}
            value={entry ? formatDate(entry.updatedAt, locale) : unavailable}
            missing={!entry}
          />
        </dl>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  missing = false,
  caution = false,
}: {
  label: string;
  value: string;
  missing?: boolean;
  caution?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${missing ? "text-muted-foreground" : caution ? "font-medium text-amber-800" : "font-medium"}`}>
        {value}
      </dd>
    </div>
  );
}

export function NoteEditor({
  supplierId,
  note,
}: {
  supplierId: string;
  note?: WorkspaceNote;
}) {
  const t = useTranslations("Catalog");
  const [state, action] = useActionState(saveNote, null);
  const [text, setText] = useState(note?.content ?? "");
  const [seen, setSeen] = useState(state);
  const deleteFormId = note ? `delete-note-${note.id}` : undefined;

  if (state !== seen) {
    setSeen(state);
    if (state?.ok && !note) {
      setText("");
    }
  }

  return (
    <>
      <form action={action} className="space-y-2">
        <label className="sr-only" htmlFor={note ? `note-${note.id}` : `note-new-${supplierId}`}>
          {t("notes")}
        </label>
        <textarea
          id={note ? `note-${note.id}` : `note-new-${supplierId}`}
          name="content"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={t("notePlaceholder")}
          className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <input type="hidden" name="supplierId" value={supplierId} />
        {note ? <input type="hidden" name="noteId" value={note.id} /> : null}
        <div className="flex flex-wrap items-center gap-2">
          <PendingButton label={note ? t("saveNote") : t("addNote")} />
          {note ? (
            <Button type="submit" form={deleteFormId} variant="ghost" size="sm">
              {t("deleteNote")}
            </Button>
          ) : null}
          {state?.ok ? <p className="text-xs text-primary">{t("noteSaved")}</p> : null}
          {state && !state.ok ? (
            <p className="text-xs text-destructive">
              {state.error === "empty" ? t("noteEmpty") : t("actionFailed")}
            </p>
          ) : null}
        </div>
      </form>
      {note ? (
        <form id={deleteFormId} action={deleteNote} className="hidden">
          <input type="hidden" name="noteId" value={note.id} />
        </form>
      ) : null}
    </>
  );
}
