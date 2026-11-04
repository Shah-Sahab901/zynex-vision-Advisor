import { NextResponse, type NextRequest } from "next/server";
import { answerQuestion, answerWithLLM } from "@/app/lib/assistant";
import type { SiteAnalysis } from "@/app/lib/types";

export async function POST(request: NextRequest) {
  let body: { question?: unknown; site?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const question: string = String(body?.question || "").trim();
  const site: SiteAnalysis | null = (body?.site as SiteAnalysis) || null;
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array>();
  const writer = stream.writable.getWriter();
  const send = (line: string) => writer.write(encoder.encode(line)).catch(() => {});

  (async () => {
    let full = "";
    try {
      const llmAnswer = await answerWithLLM(question, site);
      if (llmAnswer) {
        full = llmAnswer;
      } else {
        full = answerQuestion(question, site).text;
      }
      const words = full.split(/(\s+)/);
      for (const w of words) {
        if (!w) continue;
        send(JSON.stringify({ delta: w }) + "\n");
        await new Promise((r) => setTimeout(r, 8));
      }
      send(JSON.stringify({ done: true, text: full }) + "\n");
    } catch (err: unknown) {
      send(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to respond." }) + "\n");
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