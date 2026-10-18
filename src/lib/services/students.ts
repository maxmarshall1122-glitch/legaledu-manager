import { invalid } from "@/lib/errors";
import { RepoError } from "@/lib/db/repo";
import type { Group, Student, WorkStatus } from "@/lib/types";
import { fieldErrors, studentSchema, type StudentInput } from "@/lib/validation";
import { audit, byId, deriveWorkStatus, mustGet, requireStaff, type Ctx } from "./core";

export type StudentSort = "student_code" | "full_name" | "academic_year" | "enrollment_status" | "created_at";

export interface StudentListParams {
  q?: string;
  group?: string;
  status?: string;
  year?: string;
  sort?: StudentSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface StudentRow extends Student {
  groups: Group[];
}

export async function listStudents(ctx: Ctx, p: StudentListParams = {}) {
  requireStaff(ctx);
  const [students, groups, memberships] = await Promise.all([
    ctx.repo.list("students"),
    ctx.repo.list("groups"),
    ctx.repo.list("group_memberships"),
  ]);
  const groupMap = byId(groups);
  const groupsOf = new Map<string, Group[]>();
  for (const m of memberships) {
    const g = groupMap.get(m.group_id);
    if (g) groupsOf.set(m.student_id, [...(groupsOf.get(m.student_id) ?? []), g]);
  }
  const q = p.q?.trim().toLocaleLowerCase();
  let rows: StudentRow[] = students
    .map((s) => ({ ...s, groups: groupsOf.get(s.id) ?? [] }))
    .filter((s) => {
      if (q && !`${s.student_code} ${s.full_name} ${s.email ?? ""}`.toLocaleLowerCase().includes(q)) return false;
      if (p.group === "none" && s.groups.length > 0) return false;
      if (p.group && p.group !== "none" && !s.groups.some((g) => g.id === p.group)) return false;
      if (p.status && s.enrollment_status !== p.status) return false;
      if (p.year && s.academic_year !== p.year) return false;
      return true;
    });
  const sort = p.sort ?? "student_code";
  const dir = p.dir === "desc" ? -1 : 1;
  rows = rows.sort((a, b) => String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")) * dir);
  const pageSize = Math.min(Math.max(p.pageSize ?? 20, 5), 100);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, p.page ?? 1), pages);
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pages,
    pageSize,
    years: [...new Set(students.map((s) => s.academic_year))].sort(),
  };
}

export async function getStudentDetail(ctx: Ctx, id: string) {
  requireStaff(ctx);
  const student = await mustGet(ctx, "students", id);
  const [memberships, groups, assignments, assignmentGroups, submissions, subjects] = await Promise.all([
    ctx.repo.list("group_memberships", { eq: { student_id: id } }),
    ctx.repo.list("groups"),
    ctx.repo.list("assignments"),
    ctx.repo.list("assignment_groups"),
    ctx.repo.list("submissions", { eq: { student_id: id } }),
    ctx.repo.list("subjects"),
  ]);
  const myGroupIds = memberships.map((m) => m.group_id);
  const subjectMap = byId(subjects);
  const subByAssignment = new Map(submissions.map((s) => [s.assignment_id, s]));
  const reviews = submissions.length
    ? await ctx.repo.list("reviews", { in: { column: "submission_id", values: submissions.map((s) => s.id) } })
    : [];
  const progress = assignments
    .filter((a) => a.status !== "draft")
    .map((a) => {
      const targeted = assignmentGroups.some((ag) => ag.assignment_id === a.id && myGroupIds.includes(ag.group_id));
      const sub = subByAssignment.get(a.id) ?? null;
      const status: WorkStatus = deriveWorkStatus(a, targeted, sub);
      const approved = sub
        ? reviews
            .filter((r) => r.submission_id === sub.id && r.status === "approved")
            .sort((x, y) => y.version - x.version)[0]
        : undefined;
      return { assignment: a, subject: subjectMap.get(a.subject_id) ?? null, submission: sub, status, finalScore: approved?.final_score ?? null };
    })
    .filter((p) => p.status !== "not_assigned")
    .sort((x, y) => String(x.assignment.deadline ?? "").localeCompare(String(y.assignment.deadline ?? "")));
  return { student, groups: groups.filter((g) => myGroupIds.includes(g.id)), progress };
}

async function assertCodeFree(ctx: Ctx, code: string, exceptId?: string) {
  const existing = await ctx.repo.list("students", { eq: { student_code: code } });
  if (existing.some((s) => s.id !== exceptId)) throw invalid("students.duplicateCode", { student_code: "students.duplicateCode" });
}

async function setMemberships(ctx: Ctx, studentId: string, groupIds: string[]) {
  const current = await ctx.repo.list("group_memberships", { eq: { student_id: studentId } });
  for (const m of current) if (!groupIds.includes(m.group_id)) await ctx.repo.remove("group_memberships", m.id);
  for (const gid of groupIds) {
    if (!current.some((m) => m.group_id === gid)) await ctx.repo.insert("group_memberships", { group_id: gid, student_id: studentId });
  }
}

function parse(input: StudentInput) {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) throw invalid("validation.required", fieldErrors(parsed.error));
  return parsed.data;
}

function wrapUnique(e: unknown): never {
  if (e instanceof RepoError && e.code === "unique_violation") {
    throw invalid("students.duplicateCode", { student_code: "students.duplicateCode" });
  }
  throw e;
}

export async function createStudent(ctx: Ctx, input: StudentInput): Promise<Student> {
  requireStaff(ctx);
  const { group_ids, ...data } = parse(input);
  await assertCodeFree(ctx, data.student_code);
  const student = await ctx.repo.insert("students", { ...data, profile_id: null }).catch(wrapUnique);
  await setMemberships(ctx, student.id, group_ids);
  await audit(ctx, "student.create", "students", student.id, { student_code: student.student_code });
  return student;
}

export async function updateStudent(ctx: Ctx, id: string, input: StudentInput): Promise<Student> {
  requireStaff(ctx);
  await mustGet(ctx, "students", id);
  const { group_ids, ...data } = parse(input);
  await assertCodeFree(ctx, data.student_code, id);
  const student = await ctx.repo.update("students", id, data).catch(wrapUnique);
  await setMemberships(ctx, id, group_ids);
  await audit(ctx, "student.update", "students", id, { student_code: student.student_code });
  return student;
}

/**
 * Permanently deletes a student and (via ON DELETE CASCADE) all of their
 * submissions, reviews, grades and feedback, then removes their stored files.
 */
export async function deleteStudent(ctx: Ctx, id: string): Promise<void> {
  requireStaff(ctx);
  const student = await mustGet(ctx, "students", id);
  const subs = await ctx.repo.list("submissions", { eq: { student_id: id } });
  const files = subs.length
    ? await ctx.repo.list("submission_files", { in: { column: "submission_id", values: subs.map((s) => s.id) } })
    : [];
  await ctx.repo.remove("students", id);
  await ctx.storage.remove(files.map((f) => f.storage_key));
  await audit(ctx, "student.delete", "students", id, { student_code: student.student_code, files_removed: files.length });
}
