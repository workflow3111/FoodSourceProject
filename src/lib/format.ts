export function formatMoney(value: number, locale: string, currency = "RUB") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatQuantity(value: number, unit: string | null, locale: string) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value);
  return unit ? `${number} ${unit}` : number;
}

export function formatCalendarDate(iso: string, locale: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(year, month - 1, day),
  );
}

export function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
