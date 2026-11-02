import { getTranslations } from "next-intl/server";
import { navigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Nav");

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <p className="font-semibold">{siteConfig.name}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("note")}</p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label={nav("label")}>
          {navigation.map((item) => (
            <Link key={item.key} href={item.href} className="text-muted-foreground hover:text-foreground">
              {nav(item.key)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
