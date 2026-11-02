"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { compareSlugsFromCookieString } from "@/lib/comparison";

let snapshot: string[] | null = null;
const listeners = new Set<() => void>();

function publish(next: string[] | null) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function syncCompareMembership() {
  if (typeof document === "undefined") return;
  publish(compareSlugsFromCookieString(document.cookie));
}

export function useCompareSlugs() {
  const [slugs, setSlugs] = useState<string[] | null>(snapshot);

  useLayoutEffect(() => {
    const apply = () => setSlugs(snapshot);
    listeners.add(apply);
    apply();
    return () => {
      listeners.delete(apply);
    };
  }, []);

  return slugs;
}

export function CompareMembershipSync() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    syncCompareMembership();
  }, [pathname]);

  return null;
}
