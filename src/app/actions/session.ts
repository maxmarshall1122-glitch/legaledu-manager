"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "@/i18n";
import { getBackend, resetDemoData } from "@/lib/backend";
import { getCtx, signIn, signOut } from "@/lib/auth/server";
import { appMode } from "@/lib/config";
import { isStaff } from "@/lib/services/core";
import type { ActionResult } from "@/lib/errors";

const YEAR = 60 * 60 * 24 * 365;

export async function signInAction(_prev: unknown, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get("email") ?? "").slice(0, 254);
  const password = String(form.get("password") ?? "").slice(0, 256);
  if (!email || !password) return { error: "validation.required" };
  const res = await signIn(email, password);
  if (!res.ok) return { error: res.error };
  // Restore the user's saved language preference.
  const ctx = await getCtx();
  if (ctx) {
    const profile = await ctx.repo.get("profiles", ctx.user.id);
    if (profile && isLocale(profile.locale)) {
      (await cookies()).set(LOCALE_COOKIE, profile.locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
    }
  }
  redirect(res.role === "student" ? "/my" : "/dashboard");
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}

/** Persists the interface language in a cookie and, when signed in, in the user's profile. */
export async function setLocaleAction(locale: string): Promise<ActionResult> {
  if (!isLocale(locale)) return { ok: false, error: "validation.invalidSelection" };
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const ctx = await getCtx();
  if (ctx) {
    try {
      await ctx.repo.update("profiles", ctx.user.id, { locale });
    } catch {
      // Cookie preference still applies.
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function setThemeAction(theme: string): Promise<ActionResult> {
  if (theme !== "light" && theme !== "dark") return { ok: false, error: "validation.invalidSelection" };
  (await cookies()).set("le_theme", theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
  return { ok: true, data: undefined };
}

export async function resetDemoAction(): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx || !isStaff(ctx.user)) return { ok: false, error: "errors.forbidden" };
  if (appMode() !== "demo") return { ok: false, error: "errors.forbidden" };
  await resetDemoData();
  const { repo } = await getBackend();
  await repo.insert("audit_logs", { actor_id: ctx.user.id, action: "demo.reset", entity: "system", entity_id: null, details: null });
  revalidatePath("/", "layout");
  return { ok: true, data: undefined, message: "settings.resetDone" };
}
