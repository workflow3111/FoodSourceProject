"use client";

import { useTranslations } from "next-intl";
import type { CatalogSupplier } from "@/server/catalog-types";

export function SupplierBadges({
  supplier,
  variant = "card",
}: {
  supplier: Pick<CatalogSupplier, "dataType" | "verificationStatus" | "supplierType">;
  variant?: "card" | "profile";
}) {
  const t = useTranslations("Catalog");
  const pill = variant === "profile" ? "rounded-full px-2.5 py-0.5" : "rounded-md px-2 py-0.5";

  return (
    <div className="flex flex-wrap gap-1.5">
      {supplier.dataType === "DEMO" ? (
        <span className={`${pill} border border-amber-200 bg-amber-50 text-xs font-medium text-amber-900`}>
          {t("demo")}
        </span>
      ) : null}
      <span className={`${pill} border text-xs text-muted-foreground`}>
        {t(`verification.${supplier.verificationStatus}`)}
      </span>
      <span className={`${pill} border text-xs text-muted-foreground`}>
        {t(`types.${supplier.supplierType}`)}
      </span>
    </div>
  );
}
