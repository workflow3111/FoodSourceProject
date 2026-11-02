import { ChevronRight, Package, ShoppingBasket, Utensils, Wheat, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { productTypes, type ProductType } from "@/lib/product-type";

const visuals: Record<ProductType, { icon: LucideIcon; tone: string }> = {
  INGREDIENTS: { icon: Wheat, tone: "bg-emerald-50 text-emerald-700" },
  FINISHED_PRODUCTS: { icon: Utensils, tone: "bg-sky-50 text-sky-700" },
  PACKAGING: { icon: Package, tone: "bg-orange-50 text-orange-700" },
  OTHER_FOOD_RELATED_GOODS: { icon: ShoppingBasket, tone: "bg-muted text-muted-foreground" },
};

export function ProductTypeLinks({
  label,
  counts,
  countText,
}: {
  label: (type: ProductType) => string;
  counts: Record<ProductType, number>;
  countText: (count: number) => string;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {productTypes.map((type) => (
        <li key={type}>
          <Link
            href={`/suppliers?productType=${type}`}
            className="flex h-full items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm hover:border-primary/30"
          >
            <span className="min-w-0 flex-1">
              <TypeMark type={type} />
              <span className="mt-4 block font-semibold">{label(type)}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{countText(counts[type] ?? 0)}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TypeMark({ type }: { type: ProductType }) {
  const visual = visuals[type];
  const Icon = visual.icon;
  return (
    <span className={`flex size-11 items-center justify-center rounded-2xl ${visual.tone}`}>
      <Icon className="size-5" />
    </span>
  );
}
