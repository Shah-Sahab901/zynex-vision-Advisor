import { NextResponse } from "next/server";

const AGENT_ID = "agent_7001m2qsw00qf0p8scej6r22nqq8";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY is not configured on the server." }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(AGENT_ID)}`,
      {
        headers: { "xi-api-key": apiKey },
        cache: "no-store",
      }
    );
    const body = (await response.json().catch(() => ({}))) as { signed_url?: string; detail?: string; message?: string };
    if (!response.ok || !body.signed_url) {
      return NextResponse.json({ error: body.detail || body.message || `ElevenLabs returned ${response.status}.` }, { status: response.status || 502 });
    }
    return NextResponse.json({ signedUrl: body.signed_url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to reach ElevenLabs." }, { status: 502 });
  }
}
