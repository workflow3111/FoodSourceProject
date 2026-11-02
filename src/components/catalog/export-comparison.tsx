"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportComparisonButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations("Compare");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  async function download() {
    setState("loading");
    try {
      const response = await fetch("/compare/export", { headers: { Accept: "text/csv" } });
      if (!response.ok) throw new Error("export failed");
      const blob = await response.blob();
      const filename = filenameFrom(response.headers.get("Content-Disposition"));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={disabled || state === "loading"}
        aria-busy={state === "loading"}
        title={disabled ? t("exportEmpty") : undefined}
        onClick={() => void download()}
      >
        <Download />
        {state === "loading" ? t("exporting") : t("exportCsv")}
      </Button>
      <p className="min-h-5 text-xs" aria-live="polite">
        {state === "ready" ? <span className="text-primary">{t("exportReady")}</span> : null}
        {state === "error" ? <span className="text-destructive">{t("exportFailed")}</span> : null}
      </p>
    </div>
  );
}

function filenameFrom(header: string | null) {
  const match = /filename="([^"]+)"/.exec(header ?? "");
  return match?.[1] && /^foodsource-comparison(?:-\d{4}-\d{2}-\d{2})?\.csv$/.test(match[1])
    ? match[1]
    : "foodsource-comparison.csv";
}
