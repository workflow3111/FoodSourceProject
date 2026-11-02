"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp } from "lucide-react";

const showAfter = 400;

export function BackToTop() {
  const t = useTranslations("Shell");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > showAfter);
    const frame = requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <button
      type="button"
      className={
        visible
          ? "fixed right-4 bottom-4 z-40 inline-flex h-10 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-medium text-foreground shadow-md hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:right-6 sm:bottom-6"
          : "hidden"
      }
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    >
      <ArrowUp className="size-4 text-primary" />
      {t("backToTop")}
    </button>
  );
}
