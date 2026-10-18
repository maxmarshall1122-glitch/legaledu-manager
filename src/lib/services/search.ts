import { byId, contains, isStaff, type Ctx } from "./core";
import { listAssignmentsForStudent } from "./assignments";

const LIMIT = 20;

/** Global search across records the caller is authorized to see. */
export async function globalSearch(ctx: Ctx, rawQ: string) {
  const q = rawQ.trim().slice(0, 100);
  if (q.length < 2) return null;

  if (!isStaff(ctx.user)) {
    // Students: only their own visible assignments and their own files.
    const mine = await listAssignmentsForStudent(ctx);
    const assignments = mine.filter((m) => contains(`${m.assignment.code} ${m.assignment.title}`, q) || contains(m.subject?.name_uz, q) || contains(m.subject?.name_en, q));
    const subs = await ctx.repo.list("submissions", { eq: { student_id: ctx.user.student_id! } });
    const files = subs.length ? await ctx.repo.list("submission_files", { in: { column: "submission_id", values: subs.map((s) => s.id) } }) : [];
    return {
      students: [],
      assignments: assignments.slice(0, LIMIT).map((m) => ({ assignment: m.assignment, subject: m.subject })),
      subjects: [],
      files: files
        .filter((f) => contains(f.original_name, q))
        .slice(0, LIMIT)
        .map((f) => ({ file: f, submission: subs.find((s) => s.id === f.submission_id)!, assignment: mine.find((m) => m.assignment.id === subs.find((s) => s.id === f.submission_id)?.assignment_id)?.assignment ?? null })),
    };
  }

  const [students, assignments, subjects, files, subs] = await Promise.all([
    ctx.repo.list("students"),
    ctx.repo.list("assignments"),
    ctx.repo.list("subjects"),
    ctx.repo.list("submission_files"),
    ctx.repo.list("submissions"),
  ]);
  const subjectMap = byId(subjects);
  const subMap = byId(subs);
  const aMap = byId(assignments);
  return {
    students: students.filter((s) => contains(s.student_code, q) || contains(s.full_name, q)).slice(0, LIMIT),
    assignments: assignments
      .filter((a) => contains(a.code, q) || contains(a.title, q))
      .slice(0, LIMIT)
      .map((a) => ({ assignment: a, subject: subjectMap.get(a.subject_id) ?? null })),
    subjects: subjects.filter((s) => contains(s.code, q) || contains(s.name_uz, q) || contains(s.name_en, q)).slice(0, LIMIT),
    files: files
      .filter((f) => contains(f.original_name, q))
      .slice(0, LIMIT)
      .map((f) => {
        const submission = subMap.get(f.submission_id)!;
        return { file: f, submission, assignment: submission ? aMap.get(submission.assignment_id) ?? null : null };
      }),
  };
}

export async function listAuditLog(ctx: Ctx, limit = 100) {
  if (!isStaff(ctx.user)) return [];
  const [logs, profiles] = await Promise.all([
    ctx.repo.list("audit_logs", { order: { column: "created_at", ascending: false }, limit }),
    ctx.repo.list("profiles"),
  ]);
  const pMap = byId(profiles);
  return logs.map((l) => ({ log: l, actor: l.actor_id ? pMap.get(l.actor_id) ?? null : null }));
}
