"use client";

import { useRouter } from "@/i18n/navigation";
import { RefreshCw } from "lucide-react";
import { useTransition } from "react";

export function RefreshDashboard({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? pendingLabel : label}
    </button>
  );
}
