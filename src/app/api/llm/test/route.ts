import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callInferenceDetailed } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROBE_MESSAGES = [
  {
    role: "user",
    content:
      'Return exactly one JSON object:\n{"question":"What is StaffBook?","answer":"StaffBook is a recruitment platform."}',
  },
];

export async function POST(_req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = (process.env.HF_TOKEN || "").trim();
  const model = (process.env.HF_MODEL || "").trim();
  const router = (process.env.HF_ROUTER || "https://router.huggingface.co/v1/chat/completions").trim();

  if (!token) {
    return NextResponse.json({
      ok: false,
      error: "LLM configuration error: HF_TOKEN is missing.",
      tokenConfigured: false,
      tokenLength: 0,
      model,
      endpoint: router,
    });
  }

  const t0 = Date.now();
  const res = await callInferenceDetailed(PROBE_MESSAGES, undefined, 512);
  return NextResponse.json({
    ok: !res.error,
    content: res.content,
    error: res.error,
    latencyMs: Date.now() - t0,
    tokenConfigured: true,
    tokenLength: token.length,
    model,
    endpoint: router,
  });
}