import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PanelSkeleton } from "@/components/catalog/chrome";
import { HomePage } from "@/components/landing/home-page";
import { assertLocale } from "@/i18n/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Landing" });

  return { title: t("title") };
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = assertLocale((await params).locale);
  setRequestLocale(locale);

  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16"><PanelSkeleton /></div>}>
      <HomePage locale={locale} />
    </Suspense>
  );
}
