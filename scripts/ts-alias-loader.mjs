import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

function fileUrl(path) {
  return pathToFileURL(path).href;
}

function projectFile(base) {
  if (existsSync(base)) return base;
  for (const extension of [".ts", ".tsx"]) {
    if (existsSync(`${base}${extension}`)) return `${base}${extension}`;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const file = projectFile(join(root, "src", specifier.slice(2)));
    if (file) return { url: fileUrl(file), shortCircuit: true };
  }

  const parent = context.parentURL ? fileURLToPath(context.parentURL) : join(root, "scripts");
  const insideProject = parent.startsWith(root) && !parent.includes(`${join(root, "node_modules")}`);
  const fileName = specifier.split("/").pop() ?? specifier;

  if (insideProject && (specifier.endsWith(".ts") || specifier.endsWith(".tsx"))) {
    const path = isAbsolute(specifier) ? specifier : resolvePath(dirname(parent), specifier);
    return { url: fileUrl(path), shortCircuit: true };
  }

  if (insideProject && (specifier.startsWith("./") || specifier.startsWith("../")) && !fileName.includes(".")) {
    const file = projectFile(resolvePath(dirname(parent), specifier));
    if (file) return { url: fileUrl(file), shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith(".ts") && !url.endsWith(".tsx")) return nextLoad(url, context);

  const source = readFileSync(fileURLToPath(url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: false,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;

  return { format: "module", source: output, shortCircuit: true };
}
