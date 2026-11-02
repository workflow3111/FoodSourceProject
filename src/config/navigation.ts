import {
  ArrowLeftRight,
  Building2,
  LayoutDashboard,
  Settings,
  Star,
  Tags,
  type LucideIcon,
} from "lucide-react";

export const navigation = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard },
  { href: "/suppliers", key: "suppliers", icon: Building2 },
  { href: "/compare", key: "compare", icon: ArrowLeftRight },
  { href: "/favorites", key: "favorites", icon: Star },
  { href: "/categories", key: "categories", icon: Tags },
  { href: "/settings", key: "settings", icon: Settings },
] as const satisfies ReadonlyArray<{
  href: string;
  key: "overview" | "suppliers" | "compare" | "favorites" | "categories" | "settings";
  icon: LucideIcon;
}>;

export type NavKey = (typeof navigation)[number]["key"];

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
