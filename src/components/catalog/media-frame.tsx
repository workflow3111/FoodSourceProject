"use client";

import { initials, isDisplayableMediaUrl } from "@/lib/media";
import Image from "next/image";
import { useState } from "react";

export function MediaFrame({
  src,
  alt,
  name,
  width,
  height,
  fit = "cover",
  demo = false,
  demoLabel,
  priority = false,
  className = "",
}: {
  src: string | null;
  alt: string;
  name: string;
  width: number;
  height: number;
  fit?: "cover" | "contain";
  demo?: boolean;
  demoLabel?: string;
  priority?: boolean;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const usable = Boolean(src && isDisplayableMediaUrl(src) && !broken);

  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden bg-muted ${className}`}
      style={{ width, height }}
    >
      {usable ? (
        <Image
          src={src ?? ""}
          alt={alt}
          width={width}
          height={height}
          unoptimized
          priority={priority}
          className={fit === "contain" ? "size-full object-contain" : "size-full object-cover"}
          onError={() => setBroken(true)}
        />
      ) : (
        <span
          role="img"
          aria-label={alt}
          className="grid size-full place-items-center text-sm font-semibold text-primary"
        >
          {initials(name)}
        </span>
      )}
      {demo && usable && demoLabel ? (
        <span className="absolute right-1 bottom-1 rounded bg-amber-100 px-1 text-[10px] leading-4 font-medium text-amber-950">
          {demoLabel}
        </span>
      ) : null}
    </span>
  );
}
