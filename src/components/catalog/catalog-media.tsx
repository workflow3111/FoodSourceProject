import { MediaFrame } from "@/components/catalog/media-frame";
import type { CatalogProduct, CatalogSupplier } from "@/server/catalog-types";

export function SupplierLogo({
  supplier,
  size,
  demoAlt,
  realAlt,
  missingAlt,
  demoMark,
}: {
  supplier: Pick<CatalogSupplier, "name" | "logoUrl" | "dataType">;
  size: number;
  demoAlt: string;
  realAlt: string;
  missingAlt: string;
  demoMark?: string;
}) {
  const hasLogo = Boolean(supplier.logoUrl);
  const alt = hasLogo ? (supplier.dataType === "DEMO" ? demoAlt : realAlt) : missingAlt;
  return (
    <MediaFrame
      src={supplier.logoUrl}
      alt={alt}
      name={supplier.name}
      width={size}
      height={size}
      fit="contain"
      demo={supplier.dataType === "DEMO" && hasLogo}
      demoLabel={size >= 72 ? demoMark : undefined}
      className="rounded-lg border bg-white"
    />
  );
}

export function ProductPhoto({
  product,
  size,
  demoAlt,
  realAlt,
  missingAlt,
  demoMark,
}: {
  product: Pick<CatalogProduct, "name" | "imageUrl" | "dataType">;
  size: number;
  demoAlt: string;
  realAlt: string;
  missingAlt: string;
  demoMark?: string;
}) {
  const hasImage = Boolean(product.imageUrl);
  const alt = !hasImage ? missingAlt : product.dataType === "DEMO" ? demoAlt : realAlt;
  return (
    <MediaFrame
      src={product.imageUrl}
      alt={alt}
      name={product.name}
      width={size}
      height={size}
      fit="cover"
      demo={product.dataType === "DEMO" && hasImage}
      demoLabel={size >= 72 ? demoMark : undefined}
      className="rounded-lg border bg-white"
    />
  );
}
