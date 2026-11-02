import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <section className="mx-auto flex max-w-lg flex-col gap-3 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-sm leading-6 text-muted-foreground">{t("description")}</p>
      <Link href="/" className="text-sm font-medium text-primary">
        {t("back")}
      </Link>
    </section>
  );
}
