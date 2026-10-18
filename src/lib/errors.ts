import { RepoError } from "@/lib/db/repo";

export type AppErrorCode = "forbidden" | "not_found" | "validation" | "conflict" | "rate_limited" | "unauthenticated";

/** Errors carry a translation key (never internal details) so they are safe to show. */
export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    public messageKey: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(messageKey);
    this.name = "AppError";
  }
}

export const forbidden = () => new AppError("forbidden", "errors.forbidden");
export const notFound = () => new AppError("not_found", "errors.notFound");
export const invalid = (messageKey: string, fieldErrors?: Record<string, string>) =>
  new AppError("validation", messageKey, fieldErrors);

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Maps any thrown error to a safe, translatable action result. Internal details are only logged server-side. */
export function toActionError(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof AppError) return { ok: false, error: e.messageKey, fieldErrors: e.fieldErrors };
  if (e instanceof RepoError) {
    if (e.code === "unique_violation" || e.code === "foreign_key_violation") return { ok: false, error: "errors.conflict" };
    if (e.code === "not_found") return { ok: false, error: "errors.notFound" };
    if (e.code === "permission_denied") return { ok: false, error: "errors.forbidden" };
  }
  console.error("[action error]", e instanceof Error ? e.message : e);
  return { ok: false, error: "errors.generic" };
}
