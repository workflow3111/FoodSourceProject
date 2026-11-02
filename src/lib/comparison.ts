const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const compareCookieName = "fs-compare";
export const matchContextCookieName = "fs-match";
export const compareLimit = 3;

export type StoredMatchContext = {
  query: string;
  category: string;
  city: string;
  region: string;
  maxPrice: number | null;
  maxMoq: number | null;
  certified: boolean;
};

export function parseMatchContext(value: string | undefined): StoredMatchContext {
  const empty = { query: "", category: "", city: "", region: "", maxPrice: null, maxMoq: null, certified: false };
  if (!value || value.length > 1200) return empty;
  try {
    const parsed = JSON.parse(value) as Partial<StoredMatchContext>;
    const category = typeof parsed.category === "string" ? parsed.category : "";
    return {
      query: clip(parsed.query, 200),
      category: /^[a-z0-9-]*$/.test(category) ? category.slice(0, 80) : "",
      city: clip(parsed.city, 120),
      region: clip(parsed.region, 160),
      maxPrice: finiteCeiling(parsed.maxPrice),
      maxMoq: finiteCeiling(parsed.maxMoq),
      certified: parsed.certified === true,
    };
  } catch {
    return empty;
  }
}

function finiteCeiling(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

function clip(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function compareSlugsFromCookieString(cookieHeader: string) {
  const part = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${compareCookieName}=`));
  if (!part) return null;

  try {
    return parseCompareSlugs(decodeURIComponent(part.slice(compareCookieName.length + 1)));
  } catch {
    return [];
  }
}

export function parseCompareSlugs(value: string | undefined) {
  if (!value) {
    return [];
  }

  const slugs = value
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug) => slugPattern.test(slug));

  return [...new Set(slugs)].slice(0, compareLimit);
}
