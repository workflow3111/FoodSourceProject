"use client";

import { Menu, Wheat } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isNavItemActive, navigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { Link, usePathname } from "@/i18n/navigation";
import { CompareMembershipSync } from "@/components/catalog/compare-membership";

const headerLinks = navigation.filter((item) =>
  item.key === "overview" ||
  item.key === "suppliers" ||
  item.key === "compare" ||
  item.key === "favorites",
);

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <>
      <CompareMembershipSync />
      <HeaderBar pathname={pathname} />
    </>
  );
}

export function SiteHeaderFallback() {
  return <HeaderBar pathname={null} />;
}

function HeaderBar({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Header");
  const nav = useTranslations("Nav");

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Wheat className="size-4" />
          </span>
          {siteConfig.name}
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label={nav("label")}>
          {headerLinks.map((item) => {
            const active = pathname != null && isNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm ${
                  active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {nav(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/suppliers">{t("findSuppliers")}</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label={t("openNavigation")}
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>{nav("label")}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1" aria-label={nav("label")}>
                {navigation.map((item) => (
                  <SheetClose asChild key={item.key}>
                    <Link
                      href={item.href}
                      className="rounded-md px-3 py-2 text-sm hover:bg-accent"
                    >
                      {nav(item.key)}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
