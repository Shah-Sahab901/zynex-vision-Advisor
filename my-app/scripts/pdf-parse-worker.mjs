// Standalone PDF text extraction worker.
// Runs as a separate `node` process (outside the Next.js bundler) so pdf.js
// can load its worker without Turbopack interfering. Prints JSON to stdout.
import "./pdf-polyfill.mjs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { PDFParse } from "pdf-parse-modern";

const require = createRequire(import.meta.url);
const input = process.argv[2];

async function modernParse(buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const r = await parser.getText();
    return { numpages: r.total, text: r.text };
  } finally {
    await parser.destroy();
  }
}

async function legacyParse(buffer) {
  const pdf = require("pdf-parse");
  const r = await pdf(buffer);
  return { numpages: r.numpages, text: r.text };
}

let out;
try {
  const buffer = await readFile(input);
  try {
    out = await modernParse(buffer);
  } catch {
    out = await legacyParse(buffer);
  }
  out.ok = true;
} catch (error) {
  out = { ok: false, error: error instanceof Error ? error.message : String(error) };
}

process.stdout.write(JSON.stringify(out));