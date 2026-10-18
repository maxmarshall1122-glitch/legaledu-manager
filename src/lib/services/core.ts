import type { Repo } from "@/lib/db/repo";
import type { FileStorage } from "@/lib/storage/storage";
import { forbidden, notFound } from "@/lib/errors";
import type { Assignment, Locale, Row, SessionUser, Submission, TableName, WorkStatus } from "@/lib/types";

/** Everything a service needs. Built per request from the authenticated session. */
export interface Ctx {
  repo: Repo;
  storage: FileStorage;
  user: SessionUser;
  locale: Locale;
}

export const isStaff = (u: SessionUser) => u.role === "admin" || u.role === "lecturer";

export function requireStaff(ctx: Ctx): void {
  if (!isStaff(ctx.user)) throw forbidden();
}

/** Only lecturers (and administrators) may approve or modify final grades. */
export function requireGrader(ctx: Ctx): void {
  if (ctx.user.role !== "lecturer" && ctx.user.role !== "admin") throw forbidden();
}

export function requireStudent(ctx: Ctx): string {
  if (ctx.user.role !== "student" || !ctx.user.student_id) throw forbidden();
  return ctx.user.student_id;
}

export async function mustGet<T extends TableName>(ctx: Ctx, table: T, id: string): Promise<Row<T>> {
  const row = await ctx.repo.get(table, id);
  if (!row) throw notFound();
  return row;
}

export async function studentGroupIds(ctx: Ctx, studentId: string): Promise<string[]> {
  return (await ctx.repo.list("group_memberships", { eq: { student_id: studentId } })).map((m) => m.group_id);
}

export async function assignmentGroupIds(ctx: Ctx, assignmentId: string): Promise<string[]> {
  return (await ctx.repo.list("assignment_groups", { eq: { assignment_id: assignmentId } })).map((g) => g.group_id);
}

/** A student may see an assignment only when it is published and targets one of their groups. */
export async function studentCanSeeAssignment(ctx: Ctx, studentId: string, assignment: Assignment): Promise<boolean> {
  if (assignment.status !== "published") return false;
  const [mine, target] = await Promise.all([studentGroupIds(ctx, studentId), assignmentGroupIds(ctx, assignment.id)]);
  return target.some((g) => mine.includes(g));
}

/** Staff: any submission. Student: only their own. Throws otherwise (no existence leak). */
export async function getAuthorizedSubmission(ctx: Ctx, submissionId: string): Promise<Submission> {
  const sub = await ctx.repo.get("submissions", submissionId);
  if (!sub) throw notFound();
  if (isStaff(ctx.user)) return sub;
  if (ctx.user.role === "student" && ctx.user.student_id && sub.student_id === ctx.user.student_id) return sub;
  throw notFound();
}

export function deriveWorkStatus(
  assignment: Pick<Assignment, "status">,
  targeted: boolean,
  submission: Pick<Submission, "status"> | null | undefined,
): WorkStatus {
  if (submission) return submission.status;
  return assignment.status === "published" && targeted ? "assigned" : "not_assigned";
}

export async function audit(
  ctx: Ctx,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown> | null = null,
): Promise<void> {
  try {
    await ctx.repo.insert("audit_logs", { actor_id: ctx.user.id, action, entity, entity_id: entityId, details });
  } catch (e) {
    // Audit failures must never be silent.
    console.error("[audit] failed to record", action, entity, entityId, e instanceof Error ? e.message : e);
    throw e;
  }
}

/**
 * Human-readable record codes. In PostgreSQL they come from a sequence-backed
 * column default (safe under concurrency and RLS, where a student cannot see
 * other students' rows); returning undefined lets that default apply.
 */
export async function nextCode(ctx: Ctx, table: "assignments" | "submissions", prefix: string, width: number): Promise<string> {
  if (ctx.repo.kind === "supabase") return undefined as unknown as string;
  const rows = await ctx.repo.list(table);
  let max = 0;
  for (const r of rows) {
    const m = r.code.match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

export function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

export function pct(score: number | null | undefined, max: number): number | null {
  if (score === null || score === undefined || !(max > 0)) return null;
  return Math.round((score / max) * 1000) / 10;
}

export function avg(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

export function contains(hay: string | null | undefined, needle: string): boolean {
  return Boolean(hay) && hay!.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

export function subjectName(s: { name_uz: string; name_en: string } | null | undefined, locale: Locale): string {
  if (!s) return "";
  return locale === "uz" ? s.name_uz : s.name_en;
}
