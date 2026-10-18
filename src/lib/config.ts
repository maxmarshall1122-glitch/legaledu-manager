import "server-only";
import { supabaseEnv } from "@/lib/env";

/**
 * Server-side configuration. Secrets (API keys, service keys) are read here and
 * never passed to client components; only booleans/limits leave the server.
 */
function int(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function supabaseConfigured(): boolean {
  return supabaseEnv().configured;
}

/** Set when Supabase variables are present but unusable; the app then shows a setup page instead of crashing. */
export function configProblem() {
  return supabaseEnv().problem;
}

export type AppMode = "supabase" | "demo";

export function appMode(): AppMode {
  return supabaseConfigured() ? "supabase" : "demo";
}

export function uploadLimits() {
  return {
    maxFileBytes: int("MAX_UPLOAD_MB", 20, 1, 50) * 1024 * 1024,
    maxFilesPerSubmission: int("MAX_FILES_PER_SUBMISSION", 5, 1, 20),
  };
}

export function aiConfig() {
  return {
    anthropic: {
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    },
    gemini: {
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
    },
    timeoutMs: int("AI_TIMEOUT_SECONDS", 120, 10, 600) * 1000,
    dailyLimitPerUser: int("AI_DAILY_LIMIT", 30, 1, 1000),
    maxDocumentChars: int("AI_MAX_DOCUMENT_CHARS", 60000, 2000, 400000),
  };
}

export function dataRetentionDays(): number | null {
  const raw = process.env.DATA_RETENTION_DAYS;
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
