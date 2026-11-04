import "../../../../scripts/pdf-polyfill.mjs";
import { NextResponse, type NextRequest } from "next/server";
import { uid } from "@/app/lib/types";
import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const WORKER = join(process.cwd(), "scripts", "pdf-parse-worker.mjs");

type PdfjsApi = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsMod: PdfjsApi | null = null;

async function loadPdfjs(): Promise<PdfjsApi> {
  if (!pdfjsMod) pdfjsMod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsMod;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function normalizeText(raw: string): string {
  return raw
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s*[-–—]+\s*\d+\s+of\s+\d+\s*[-–—]*\s*\n?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\S)-\n(\S)/g, "$1$2")
    .trim();
}

async function parseWithPdfjs(buffer: Buffer): Promise<{ numpages: number; text: string }> {
  const pdfjs = await loadPdfjs();
  try {
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  } catch {
    /* keep the library default when the worker cannot be resolved */
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        const tc = await page.getTextContent();
        const text = tc.items.map((item) => ("str" in item ? item.str : "")).join("");
        if (text.trim()) pages.push(text.trim());
      } finally {
        page.cleanup();
      }
    }
    return { numpages: doc.numPages, text: pages.join("\n\n") };
  } finally {
    await doc.destroy();
  }
}

function parseWithWorker(buffer: Buffer): Promise<{ numpages: number; text: string }> {
  return new Promise((resolve, reject) => {
    mkdtemp(join(tmpdir(), "webmind-pdf-"))
      .then((dir) => {
        const input = join(dir, "input.pdf");
        return writeFile(input, buffer).then(() => {
          const child = spawn(process.execPath, [WORKER, input], { stdio: ["ignore", "pipe", "pipe"] });
          let stdout = "";
          let stderr = "";
          child.stdout.on("data", (d) => (stdout += d));
          child.stderr.on("data", (d) => (stderr += d));
          const timer = setTimeout(() => child.kill(), 60000);
          child.on("error", (err) => {
            clearTimeout(timer);
            rm(dir, { recursive: true, force: true }).catch(() => undefined);
            reject(err);
          });
          child.on("close", (code) => {
            clearTimeout(timer);
            rm(dir, { recursive: true, force: true }).catch(() => undefined);
            if (code === 0) {
              try {
                const r = JSON.parse(stdout) as { ok?: boolean; numpages?: number; text?: string; error?: string };
                if (r.ok && typeof r.text === "string") {
                  resolve({ numpages: r.numpages ?? 0, text: r.text });
                  return;
                }
                reject(new Error(r.error || "PDF text extraction failed."));
              } catch {
                reject(new Error("PDF worker returned an invalid response."));
              }
            } else {
              reject(new Error(stderr.trim() || `PDF worker exited with code ${code}.`));
            }
          });
        });
      })
      .catch(reject);
  });
}

export async function POST(request: NextRequest) {
  let file: File;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (!(candidate instanceof File)) return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
    file = candidate;
  } catch (error) {
    return NextResponse.json({ error: `Could not read the uploaded file: ${errText(error)}` }, { status: 400 });
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 415 });
  }
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "PDF must be smaller than 15 MB." }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed: { numpages: number; text: string };

  try {
    parsed = await parseWithPdfjs(buffer);
  } catch (inProcessError) {
    console.warn("In-process PDF parse failed, trying worker:", errText(inProcessError));
    try {
      parsed = await parseWithWorker(buffer);
    } catch (workerError) {
      const workerMessage = errText(workerError);
      console.warn("PDF text extraction unavailable:", workerMessage);
      parsed = {
        numpages: 0,
        text: `This PDF could not be parsed as text. It may be scanned, password protected, or use an unsupported format. The document entry is available in the Documents panel for review.\n\n[Parse diagnostic — in-process: ${errText(inProcessError).slice(0, 400)} | worker: ${workerMessage.slice(0, 400)}]`,
      };
    }
  }

  return NextResponse.json({
    document: {
      id: uid(),
      name: file.name,
      size: file.size,
      pages: parsed.numpages,
      text: normalizeText(parsed.text).slice(0, 120000),
      uploadedAt: new Date().toISOString(),
    },
  });
}