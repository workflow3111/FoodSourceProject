import assert from "node:assert/strict";
import { comparisonExportFilename, csvField, toCsv } from "./csv";

assert.equal(csvField("plain").charAt(0), '"');
assert.equal(csvField('say "hello"'), '"say ""hello"""');
assert.equal(csvField("a,b"), '"a,b"');
assert.equal(csvField("line\nnext"), '"line\nnext"');
assert.equal(csvField("=1+1"), "\"'=1+1\"");
assert.equal(csvField("+1"), "\"'+1\"");
assert.equal(csvField("-10"), "\"'-10\"");
assert.equal(csvField("@sum"), "\"'@sum\"");
assert.equal(csvField("  =cmd"), "\"'  =cmd\"");
assert.equal(csvField("\t=cmd"), "\"'\t=cmd\"");

const file = toCsv([
  ["Name", "Note"],
  ["Молоко", 'He said "yes",\nthen left'],
  ["=HYPERLINK(\"http://evil\")", "safe"],
]);
assert.equal(file.charCodeAt(0), 0xfeff);
assert.equal(file.includes("\r\n"), true);
assert.deepEqual(parseCsv(file), [
  ["Name", "Note"],
  ["Молоко", 'He said "yes",\nthen left'],
  ["'=HYPERLINK(\"http://evil\")", "safe"],
]);
assert.equal(comparisonExportFilename("2026-11-01"), "foodsource-comparison-2026-11-01.csv");
assert.equal(comparisonExportFilename("today"), "foodsource-comparison.csv");

function parseCsv(text: string) {
  const source = text.slice(1).replace(/\r\n$/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r" && source[index + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

console.log("csv checks passed");
