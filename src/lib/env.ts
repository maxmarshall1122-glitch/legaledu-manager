/**
 * Supabase connection settings, shared by proxy.ts and server code (no
 * "server-only" import so the proxy can use it). Values are trimmed because
 * copy-pasting into hosting dashboards often adds stray spaces/newlines.
 */
export type SupabaseEnvProblem = "url_missing" | "url_invalid" | "key_missing" | null;

export function supabaseEnv(): { url: string; anonKey: string; problem: SupabaseEnvProblem; configured: boolean } {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url && !anonKey) return { url, anonKey, problem: null, configured: false };
  let problem: SupabaseEnvProblem = null;
  if (!url) problem = "url_missing";
  else if (!/^https?:\/\/[^\s/]+$/i.test(url)) problem = "url_invalid";
  else if (!anonKey) problem = "key_missing";
  return { url, anonKey, problem, configured: problem === null };
}
