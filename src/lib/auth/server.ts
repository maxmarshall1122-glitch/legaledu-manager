import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { appMode } from "@/lib/config";
import { getBackend, getDemoBackend, supabaseServerClient } from "@/lib/backend";
import { DEMO_ACCOUNTS } from "@/lib/demo/seed";
import { AppError } from "@/lib/errors";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n";
import { clearRateLimit, rateLimit } from "@/lib/rate-limit";
import type { Ctx } from "@/lib/services/core";
import type { Locale, SessionUser } from "@/lib/types";
import { DEMO_SESSION_COOKIE, DEMO_SESSION_TTL_SECONDS, safeEqual, signSession, verifySession } from "./demo-session";

export const DEMO_PASSWORD = () => process.env.DEMO_PASSWORD || "demo-2026";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

async function loadUser(profileId: string): Promise<SessionUser | null> {
  const { repo } = await getBackend();
  const profile = await repo.get("profiles", profileId);
  if (!profile) return null;
  let studentId: string | null = null;
  if (profile.role === "student") {
    studentId = (await repo.list("students", { eq: { profile_id: profile.id }, limit: 1 }))[0]?.id ?? null;
  }
  return { id: profile.id, role: profile.role, full_name: profile.full_name, email: profile.email, student_id: studentId };
}

/** Resolves the signed-in user once per request. Authorization is still enforced in every service call. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (appMode() === "demo") {
    const demo = await getDemoBackend();
    const uid = verifySession((await cookies()).get(DEMO_SESSION_COOKIE)?.value, demo.secret);
    return uid ? loadUser(uid) : null;
  }
  const supabase = await supabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return loadUser(data.user.id);
});

export const getCtx = cache(async (): Promise<Ctx | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const { repo, storage } = await getBackend();
  return { repo, storage, user, locale: await getLocale() };
});

/** For pages: redirects to /login when signed out. */
export async function requirePageCtx(roles?: SessionUser["role"][]): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (roles && !roles.includes(ctx.user.role)) redirect(ctx.user.role === "student" ? "/my" : "/dashboard");
  return ctx;
}

/** For server actions and route handlers. */
export async function requireActionCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) throw new AppError("unauthenticated", "auth.sessionExpired");
  return ctx;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export async function signIn(email: string, password: string): Promise<{ ok: true; role: SessionUser["role"] } | { ok: false; error: string }> {
  const ip = await clientIp();
  const normalized = email.trim().toLowerCase();
  if (!rateLimit(`login:ip:${ip}`, 20, 60_000).ok || !rateLimit(`login:email:${normalized}`, 5, 60_000).ok) {
    return { ok: false, error: "auth.tooManyAttempts" };
  }
  if (appMode() === "demo") {
    const account = DEMO_ACCOUNTS.find((a) => a.email === normalized);
    const passwordOk = safeEqual(password, DEMO_PASSWORD());
    if (!account || !passwordOk) return { ok: false, error: "auth.invalidCredentials" };
    const demo = await getDemoBackend();
    const user = await loadUser(account.id);
    if (!user) return { ok: false, error: "auth.invalidCredentials" };
    (await cookies()).set(DEMO_SESSION_COOKIE, signSession(account.id, demo.secret), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEMO_SESSION_TTL_SECONDS,
    });
    await demo.repo.insert("audit_logs", { actor_id: account.id, action: "auth.sign_in", entity: "profiles", entity_id: account.id, details: { mode: "demo" } });
    clearRateLimit(`login:email:${normalized}`);
    return { ok: true, role: user.role };
  }
  const supabase = await supabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error || !data.user) return { ok: false, error: "auth.invalidCredentials" };
  const user = await loadUser(data.user.id);
  if (!user) {
    await supabase.auth.signOut();
    return { ok: false, error: "auth.forbidden" };
  }
  clearRateLimit(`login:email:${normalized}`);
  return { ok: true, role: user.role };
}

export async function signOut(): Promise<void> {
  if (appMode() === "demo") {
    (await cookies()).delete(DEMO_SESSION_COOKIE);
    return;
  }
  const supabase = await supabaseServerClient();
  await supabase.auth.signOut();
}
