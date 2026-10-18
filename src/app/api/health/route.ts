import { NextResponse } from "next/server";
import { aiConfig, appMode } from "@/lib/config";
import { supabaseEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Deployment diagnostics. Reports only booleans and the backend mode —
 * never secrets, keys, URLs or data — so it is safe to expose publicly.
 */
export async function GET() {
  const env = supabaseEnv();
  const ai = aiConfig();
  return NextResponse.json(
    {
      ok: env.problem === null,
      mode: env.problem ? "misconfigured" : appMode(),
      problem: env.problem,
      supabase: { urlSet: Boolean(env.url), anonKeySet: Boolean(env.anonKey) },
      ai: { anthropic: ai.anthropic.configured, gemini: ai.gemini.configured },
      host: process.env.VERCEL ? "vercel" : "other",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
