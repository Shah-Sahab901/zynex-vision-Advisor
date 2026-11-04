import { NextResponse, type NextRequest } from "next/server";
import { analyzeSite } from "@/app/lib/crawler";
import { demoAnalysis } from "@/app/lib/demo";
import type { AnalyzeEvent, SiteAnalysis } from "@/app/lib/types";

export async function POST(request: NextRequest) {
  let body: { url?: unknown; demoMode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const url = typeof body?.url === "string" ? body.url : "";
  const demoMode = Boolean(body?.demoMode);
  if (!url && !demoMode) {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array>();
  const writer = stream.writable.getWriter();

  const send = (ev: AnalyzeEvent) => {
    writer.write(encoder.encode(JSON.stringify(ev) + "\n")).catch(() => {});
  };

  (async () => {
    try {
      let result: SiteAnalysis;
      if (demoMode) {
        send({ type: "log", message: "Loading demo intelligence…" });
        await new Promise((r) => setTimeout(r, 1800));
        send({ type: "step", stepId: "homepage", state: "active", detail: "aurora-analytics.com" });
        await new Promise((r) => setTimeout(r, 1200));
        send({ type: "step", stepId: "homepage", state: "done", detail: "Aurora Analytics — Product analytics" });
        send({ type: "step", stepId: "discover", state: "active", detail: "Discovering important pages…" });
        await new Promise((r) => setTimeout(r, 600));
        send({ type: "step", stepId: "discover", state: "done", detail: "6 pages discovered" });
        const steps = ["extract", "products", "services", "pricing", "images", "faq", "analytics", "insights"] as const;
        for (const stepId of steps) {
          send({ type: "step", stepId, state: "active", detail: stepId });
          await new Promise((r) => setTimeout(r, 280));
          send({ type: "step", stepId, state: "done", detail: stepId });
        }
        result = demoAnalysis();
      } else {
        let aborted = false;
        request.signal.addEventListener("abort", () => {
          aborted = true;
        });
        result = await analyzeSite(url, {
          maxPages: 16,
          emit: (ev) => {
            if (!aborted) send(ev);
          },
        });
        if (aborted) return;
      }
      send({ type: "complete", data: result as SiteAnalysis });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      send({ type: "error", message });
    } finally {
      try {
        await writer.close();
      } catch {
        writer.releaseLock();
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}