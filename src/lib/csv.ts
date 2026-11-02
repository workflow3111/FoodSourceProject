const formulaPrefix = /^[=+\-@]|^[\t\r]/;

/** RFC 4180 field encoding, with a leading apostrophe when a spreadsheet could treat the cell as a formula. */
export function csvField(value: string) {
  const text = value.replaceAll("\0", "");
  const safe = formulaPrefix.test(text.trimStart()) || /^[\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(rows: string[][]) {
  const body = rows.map((row) => row.map((value) => csvField(value)).join(",")).join("\r\n");
  return `\uFEFF${body}\r\n`;
}

export function comparisonExportFilename(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `foodsource-comparison-${day}.csv` : "foodsource-comparison.csv";
}
