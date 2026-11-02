export function isDisplayableMediaUrl(src: string) {
  if (src.startsWith("/images/") && src.endsWith(".jpg") && !src.includes("..") && !src.includes("\\")) {
    return true;
  }
  try {
    return new URL(src).protocol === "https:";
  } catch {
    return false;
  }
}

export function initials(name: string) {
  const words = name
    .replace(/[«»"']/g, " ")
    .split(/[\s-]+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !(word.length <= 5 && word === word.toUpperCase() && /^[A-ZА-ЯЁ0-9]+$/.test(word)));
  const source = words.length ? words : [name];
  const first = source[0] ?? name;
  const second = source[1];
  if (second?.[0]) return `${first[0] ?? ""}${second[0]}`.toLocaleUpperCase("ru");
  const internal = first.slice(1).match(/[A-ZА-ЯЁ]/);
  if (internal?.[0] && first[0]) return `${first[0]}${internal[0]}`.toLocaleUpperCase("ru");
  return (first[0] ?? "?").toLocaleUpperCase("ru");
}
