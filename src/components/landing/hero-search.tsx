"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";

export function HeroSearch() {
  const t = useTranslations("Header");
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    router.push(
      nextQuery ? `/suppliers?q=${encodeURIComponent(nextQuery)}` : "/suppliers",
    );
  }

  return (
    <form
      role="search"
      onSubmit={onSearch}
      className="mt-8 flex w-full max-w-xl items-center rounded-xl border bg-card p-1 shadow-sm"
    >
      <label className="sr-only" htmlFor="landing-search">
        {t("searchLabel")}
      </label>
      <Search aria-hidden className="ml-3 size-4 shrink-0 text-muted-foreground" />
      <Input
        id="landing-search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <Button type="submit" className="h-10 shrink-0 rounded-lg px-5">
        {t("searchSubmit")}
      </Button>
    </form>
  );
}
