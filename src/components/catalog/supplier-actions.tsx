"use client";

import { useActionState, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Bookmark, Heart } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { syncCompareMembership, useCompareSlugs } from "@/components/catalog/compare-membership";
import { Link } from "@/i18n/navigation";
import { addToComparison, toggleFavorite } from "@/server/actions";

const favoriteState = new Map<string, { saved: boolean; generation: number }>();
const favoriteListeners = new Map<string, Set<() => void>>();
let favoriteGeneration = 0;

function publishFavorite(supplierId: string, saved: boolean) {
  favoriteGeneration += 1;
  favoriteState.set(supplierId, { saved, generation: favoriteGeneration });
  favoriteListeners.get(supplierId)?.forEach((listener) => listener());
}

function subscribeFavorite(supplierId: string, listener: () => void) {
  let bucket = favoriteListeners.get(supplierId);
  if (!bucket) {
    bucket = new Set();
    favoriteListeners.set(supplierId, bucket);
  }
  bucket.add(listener);
  return () => {
    bucket.delete(listener);
  };
}

function useFavoriteEntry(supplierId: string) {
  return useSyncExternalStore(
    (listener) => subscribeFavorite(supplierId, listener),
    () => favoriteState.get(supplierId) ?? null,
    () => null,
  );
}

export function FavoriteButton({
  supplierId,
  saved,
  appearance = "text",
  className,
}: {
  supplierId: string;
  saved: boolean;
  appearance?: "text" | "labeled" | "icon" | "bookmark";
  className?: string;
}) {
  const entry = useFavoriteEntry(supplierId);
  const currentSaved = entry?.saved ?? saved;

  return (
    <FavoriteButtonControl
      key={`${appearance}:${entry?.generation ?? 0}:${currentSaved ? "1" : "0"}`}
      supplierId={supplierId}
      saved={currentSaved}
      appearance={appearance}
      className={className}
    />
  );
}

function FavoriteButtonControl({
  supplierId,
  saved,
  appearance,
  className,
}: {
  supplierId: string;
  saved: boolean;
  appearance: "text" | "labeled" | "icon" | "bookmark";
  className?: string;
}) {
  const t = useTranslations("Catalog");
  const [state, action, pending] = useActionState(toggleFavorite, null);
  const [open, setOpen] = useState(false);
  const isSaved = state?.ok ? state.saved : saved;
  const formId = `remove-favorite-${appearance}-${supplierId}`;
  const [trackedSaved, setTrackedSaved] = useState(isSaved);

  if (trackedSaved !== isSaved) {
    setTrackedSaved(isSaved);
    if (!isSaved) setOpen(false);
  }

  useLayoutEffect(() => {
    if (state?.ok) publishFavorite(supplierId, state.saved);
  }, [state, supplierId]);

  if (isSaved) {
    return (
      <>
        <form
          id={formId}
          action={action}
          onSubmit={(event) => {
            const submitter = event.nativeEvent.submitter;
            const confirmed = submitter instanceof HTMLButtonElement && submitter.dataset.confirm === "remove";
            if (!confirmed) {
              event.preventDefault();
              setOpen(true);
              return;
            }
            setOpen(false);
          }}
        >
          <input type="hidden" name="supplierId" value={supplierId} />
          <FavoriteControl
            appearance={appearance}
            className={className}
            pending={pending}
            saved
            label={t("saved")}
          />
        </form>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("confirmRemoveTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("confirmRemoveText")}</AlertDialogDescription>
            </AlertDialogHeader>
            {state && !state.ok ? (
              <p className="text-sm text-destructive">{t("actionFailed")}</p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                {t("cancel")}
              </AlertDialogCancel>
              <Button
                type="submit"
                form={formId}
                data-confirm="remove"
                variant="destructive"
                disabled={pending}
              >
                {t("confirmRemove")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="supplierId" value={supplierId} />
      <FavoriteControl
        appearance={appearance}
        className={className}
        pending={pending}
        saved={false}
        label={t("save")}
      />
      {state && !state.ok ? (
        <p className="mt-1 text-xs text-destructive">{t("actionFailed")}</p>
      ) : null}
    </form>
  );
}

function FavoriteControl({
  appearance,
  className,
  pending,
  saved,
  label,
}: {
  appearance: "text" | "labeled" | "icon" | "bookmark";
  className?: string;
  pending: boolean;
  saved: boolean;
  label: string;
}) {
  if (appearance === "icon") {
    return (
      <Button type="submit" variant="ghost" size="icon-sm" className={className} disabled={pending} aria-label={label}>
        <Heart className={saved ? "fill-primary text-primary" : "text-muted-foreground"} />
      </Button>
    );
  }
  if (appearance === "bookmark") {
    return (
      <Button type="submit" variant="outline" size="sm" className={className} disabled={pending}>
        <Bookmark />
        {label}
      </Button>
    );
  }
  if (appearance === "labeled") {
    return (
      <Button type="submit" variant="outline" size="sm" className={`w-full ${className ?? ""}`} disabled={pending}>
        <Bookmark />
        {label}
      </Button>
    );
  }
  return (
    <Button type="submit" variant={saved ? "secondary" : "outline"} size="sm" className={className} disabled={pending}>
      {label}
    </Button>
  );
}

export function CompareButton({
  slug,
  active,
  context,
  className,
  showIcon = false,
  activeVariant = "secondary",
}: {
  slug: string;
  active: boolean;
  context?: {
    query: string;
    category: string;
    city: string;
    region: string;
    maxPrice?: string;
    maxMoq?: string;
    certified?: boolean;
  };
  className?: string;
  showIcon?: boolean;
  activeVariant?: "default" | "secondary";
}) {
  const slugs = useCompareSlugs();
  const member = slugs ? slugs.includes(slug) : active;

  return (
    <CompareControl
      key={slugs ? slugs.join(",") : "server"}
      slug={slug}
      active={member}
      context={context}
      className={className}
      showIcon={showIcon}
      activeVariant={activeVariant}
    />
  );
}

function CompareControl({
  slug,
  active,
  context,
  className,
  showIcon = false,
  activeVariant = "secondary",
}: {
  slug: string;
  active: boolean;
  context?: {
    query: string;
    category: string;
    city: string;
    region: string;
    maxPrice?: string;
    maxMoq?: string;
    certified?: boolean;
  };
  className?: string;
  showIcon?: boolean;
  activeVariant?: "default" | "secondary";
}) {
  const t = useTranslations("Catalog");
  const [state, action, pending] = useActionState(addToComparison, null);
  const comparing = state?.ok ? state.comparing : active;

  useLayoutEffect(() => {
    if (state?.ok) syncCompareMembership();
  }, [state]);

  if (comparing) {
    return (
      <Button asChild variant={activeVariant} size="sm" className={className}>
        <Link href="/compare">
          {showIcon ? <ArrowLeftRight /> : null}
          {t("inCompare")}
        </Link>
      </Button>
    );
  }

  return (
    <form action={action} className={className?.includes("w-full") ? "min-w-0 w-full" : undefined}>
      <input type="hidden" name="slug" value={slug} />
      {context ? (
        <>
          <input type="hidden" name="rememberContext" value="1" />
          <input type="hidden" name="q" value={context.query} />
          <input type="hidden" name="category" value={context.category} />
          <input type="hidden" name="city" value={context.city} />
          <input type="hidden" name="region" value={context.region} />
          <input type="hidden" name="maxPrice" value={context.maxPrice ?? ""} />
          <input type="hidden" name="maxMoq" value={context.maxMoq ?? ""} />
          {context.certified ? <input type="hidden" name="certified" value="1" /> : null}
        </>
      ) : null}
      <Button type="submit" size="sm" className={className} disabled={pending}>
        {showIcon ? <ArrowLeftRight /> : null}
        {t("compare")}
      </Button>
      {state && !state.ok ? (
        <p className="mt-1 max-w-xs text-xs text-destructive">
          {state.error === "full" ? t("compareFull") : t("actionFailed")}
        </p>
      ) : null}
    </form>
  );
}
