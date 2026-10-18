import { invalid, notFound } from "@/lib/errors";
import type { Assignment, AssignmentStatus, Group, RubricCriterion, Student, Submission, WorkStatus } from "@/lib/types";
import { assignmentSchema, fieldErrors, type AssignmentInput } from "@/lib/validation";
import {
  assignmentGroupIds,
  audit,
  byId,
  contains,
  deriveWorkStatus,
  mustGet,
  nextCode,
  requireStaff,
  requireStudent,
  studentCanSeeAssignment,
  studentGroupIds,
  type Ctx,
} from "./core";

export interface AssignmentListParams {
  q?: string;
  subject?: string;
  status?: string;
  group?: string;
  type?: string;
}

/** Students expected to submit: members of any target group. */
async function expectedStudents(ctx: Ctx, assignmentId: string): Promise<Student[]> {
  const groupIds = await assignmentGroupIds(ctx, assignmentId);
  if (groupIds.length === 0) return [];
  const memberships = await ctx.repo.list("group_memberships", { in: { column: "group_id", values: groupIds } });
  const ids = [...new Set(memberships.map((m) => m.student_id))];
  if (ids.length === 0) return [];
  return ctx.repo.list("students", { in: { column: "id", values: ids }, order: { column: "student_code" } });
}

export async function listAssignments(ctx: Ctx, p: AssignmentListParams = {}) {
  requireStaff(ctx);
  const [assignments, subjects, ag, groups, memberships, submissions] = await Promise.all([
    ctx.repo.list("assignments", { order: { column: "created_at", ascending: false } }),
    ctx.repo.list("subjects"),
    ctx.repo.list("assignment_groups"),
    ctx.repo.list("groups"),
    ctx.repo.list("group_memberships"),
    ctx.repo.list("submissions"),
  ]);
  const subjectMap = byId(subjects);
  const groupMap = byId(groups);
  return assignments
    .filter((a) => {
      if (p.q && !contains(`${a.code} ${a.title}`, p.q)) return false;
      if (p.subject && a.subject_id !== p.subject) return false;
      if (p.status && a.status !== p.status) return false;
      if (p.type && a.assignment_type !== p.type) return false;
      if (p.group && !ag.some((x) => x.assignment_id === a.id && x.group_id === p.group)) return false;
      return true;
    })
    .map((a) => {
      const gids = ag.filter((x) => x.assignment_id === a.id).map((x) => x.group_id);
      const expected = new Set(memberships.filter((m) => gids.includes(m.group_id)).map((m) => m.student_id));
      return {
        assignment: a,
        subject: subjectMap.get(a.subject_id) ?? null,
        groups: gids.map((g) => groupMap.get(g)).filter((g): g is Group => Boolean(g)),
        expected: expected.size,
        submitted: submissions.filter((s) => s.assignment_id === a.id).length,
      };
    });
}

export async function getAssignmentDetail(ctx: Ctx, id: string) {
  requireStaff(ctx);
  const assignment = await mustGet(ctx, "assignments", id);
  const [subject, groupIds, criteria, materials, groups, submissions, students] = await Promise.all([
    ctx.repo.get("subjects", assignment.subject_id),
    assignmentGroupIds(ctx, id),
    ctx.repo.list("rubric_criteria", { eq: { assignment_id: id }, order: { column: "position" } }),
    ctx.repo.list("teaching_materials", { eq: { assignment_id: id } }),
    ctx.repo.list("groups", { order: { column: "name" } }),
    ctx.repo.list("submissions", { eq: { assignment_id: id } }),
    expectedStudents(ctx, id),
  ]);
  const subByStudent = new Map(submissions.map((s) => [s.student_id, s]));
  const allStudents = byId(await ctx.repo.list("students"));
  const matrix: { student: Student; submission: Submission | null; status: WorkStatus }[] = students.map((st) => {
    const sub = subByStudent.get(st.id) ?? null;
    return { student: st, submission: sub, status: deriveWorkStatus(assignment, true, sub) };
  });
  // Submissions from students no longer in a target group are still shown.
  for (const s of submissions) {
    if (!students.some((st) => st.id === s.student_id)) {
      const st = allStudents.get(s.student_id);
      if (st) matrix.push({ student: st, submission: s, status: s.status });
    }
  }
  return {
    assignment,
    subject,
    groups: groups.filter((g) => groupIds.includes(g.id)),
    allGroups: groups,
    criteria,
    materials,
    matrix,
  };
}

function parse(input: AssignmentInput) {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) throw invalid("validation.required", fieldErrors(parsed.error));
  return parsed.data;
}

function assertPublishable(groupIds: string[], deadline: string | null) {
  if (groupIds.length === 0) throw invalid("assignments.publishRequiresGroups", { group_ids: "assignments.publishRequiresGroups" });
  if (!deadline) throw invalid("assignments.publishRequiresDeadline", { deadline: "assignments.publishRequiresDeadline" });
}

async function setGroups(ctx: Ctx, assignmentId: string, groupIds: string[]) {
  const current = await ctx.repo.list("assignment_groups", { eq: { assignment_id: assignmentId } });
  for (const g of current) if (!groupIds.includes(g.group_id)) await ctx.repo.remove("assignment_groups", g.id);
  for (const gid of groupIds) {
    if (!current.some((g) => g.group_id === gid)) await ctx.repo.insert("assignment_groups", { assignment_id: assignmentId, group_id: gid });
  }
}

async function setMaterials(ctx: Ctx, assignment: Assignment, materialIds: string[]) {
  const current = await ctx.repo.list("teaching_materials", { eq: { assignment_id: assignment.id } });
  for (const m of current) if (!materialIds.includes(m.id)) await ctx.repo.update("teaching_materials", m.id, { assignment_id: null });
  for (const mid of materialIds) {
    const m = await ctx.repo.get("teaching_materials", mid);
    if (!m || m.subject_id !== assignment.subject_id) throw invalid("validation.invalidSelection");
    if (m.assignment_id !== assignment.id) await ctx.repo.update("teaching_materials", mid, { assignment_id: assignment.id });
  }
}

/** Upserts criteria by id. Criteria that already carry scores cannot be removed. */
async function setCriteria(ctx: Ctx, assignmentId: string, criteria: ReturnType<typeof parse>["criteria"]) {
  const current = await ctx.repo.list("rubric_criteria", { eq: { assignment_id: assignmentId } });
  const keep = new Set(criteria.map((c) => c.id).filter(Boolean));
  for (const c of current) {
    if (keep.has(c.id)) continue;
    const scored = await ctx.repo.list("rubric_scores", { eq: { criterion_id: c.id }, limit: 1 });
    if (scored.length > 0) throw invalid("errors.conflict");
    await ctx.repo.remove("rubric_criteria", c.id);
  }
  for (const [position, c] of criteria.entries()) {
    const data = { title: c.title, description: c.description, max_points: c.max_points, weight: c.weight, position };
    if (c.id && current.some((x) => x.id === c.id)) await ctx.repo.update("rubric_criteria", c.id, data);
    else await ctx.repo.insert("rubric_criteria", { ...data, assignment_id: assignmentId });
  }
}

export async function createAssignment(ctx: Ctx, input: AssignmentInput, status: "draft" | "published"): Promise<Assignment> {
  requireStaff(ctx);
  const data = parse(input);
  await mustGet(ctx, "subjects", data.subject_id);
  if (status === "published") assertPublishable(data.group_ids, data.deadline);
  const { group_ids, criteria, material_ids, ...fields } = data;
  const assignment = await ctx.repo.insert("assignments", {
    ...fields,
    code: await nextCode(ctx, "assignments", "ASG-", 4),
    status,
    created_by: ctx.user.id,
  });
  await setGroups(ctx, assignment.id, group_ids);
  await setCriteria(ctx, assignment.id, criteria);
  await setMaterials(ctx, assignment, material_ids);
  await audit(ctx, "assignment.create", "assignments", assignment.id, { code: assignment.code, status });
  return assignment;
}

export async function updateAssignment(ctx: Ctx, id: string, input: AssignmentInput): Promise<Assignment> {
  requireStaff(ctx);
  const existing = await mustGet(ctx, "assignments", id);
  const data = parse(input);
  await mustGet(ctx, "subjects", data.subject_id);
  if (existing.status === "published") assertPublishable(data.group_ids, data.deadline);
  const { group_ids, criteria, material_ids, ...fields } = data;
  const assignment = await ctx.repo.update("assignments", id, fields);
  await setGroups(ctx, id, group_ids);
  await setCriteria(ctx, id, criteria);
  await setMaterials(ctx, assignment, material_ids);
  await audit(ctx, "assignment.update", "assignments", id, { code: assignment.code });
  return assignment;
}

export async function setAssignmentStatus(ctx: Ctx, id: string, status: AssignmentStatus): Promise<Assignment> {
  requireStaff(ctx);
  const a = await mustGet(ctx, "assignments", id);
  if (status === "published") assertPublishable(await assignmentGroupIds(ctx, id), a.deadline);
  const updated = await ctx.repo.update("assignments", id, { status });
  await audit(ctx, `assignment.${status}`, "assignments", id, { code: a.code, from: a.status, to: status });
  return updated;
}

export async function deleteAssignment(ctx: Ctx, id: string): Promise<void> {
  requireStaff(ctx);
  const a = await mustGet(ctx, "assignments", id);
  const subs = await ctx.repo.list("submissions", { eq: { assignment_id: id } });
  const files = subs.length
    ? await ctx.repo.list("submission_files", { in: { column: "submission_id", values: subs.map((s) => s.id) } })
    : [];
  await ctx.repo.remove("assignments", id);
  await ctx.storage.remove(files.map((f) => f.storage_key));
  await audit(ctx, "assignment.delete", "assignments", id, { code: a.code, submissions_removed: subs.length });
}

// ---------- Student-facing ----------

export async function listAssignmentsForStudent(ctx: Ctx) {
  const studentId = requireStudent(ctx);
  const myGroups = await studentGroupIds(ctx, studentId);
  if (myGroups.length === 0) return [];
  const ag = await ctx.repo.list("assignment_groups", { in: { column: "group_id", values: myGroups } });
  const ids = [...new Set(ag.map((x) => x.assignment_id))];
  if (ids.length === 0) return [];
  const [assignments, subjects, subs] = await Promise.all([
    ctx.repo.list("assignments", { in: { column: "id", values: ids } }),
    ctx.repo.list("subjects"),
    ctx.repo.list("submissions", { eq: { student_id: studentId } }),
  ]);
  const subjectMap = byId(subjects);
  return assignments
    .filter((a) => a.status === "published")
    .map((a) => {
      const sub = subs.find((s) => s.assignment_id === a.id) ?? null;
      return { assignment: a, subject: subjectMap.get(a.subject_id) ?? null, submission: sub, status: deriveWorkStatus(a, true, sub) };
    })
    .sort((x, y) => String(x.assignment.deadline ?? "").localeCompare(String(y.assignment.deadline ?? "")));
}

export async function getAssignmentForStudent(ctx: Ctx, id: string) {
  const studentId = requireStudent(ctx);
  const assignment = await ctx.repo.get("assignments", id);
  if (!assignment || !(await studentCanSeeAssignment(ctx, studentId, assignment))) throw notFound();
  const [subject, criteria, materials, subs] = await Promise.all([
    ctx.repo.get("subjects", assignment.subject_id),
    ctx.repo.list("rubric_criteria", { eq: { assignment_id: id }, order: { column: "position" } }),
    ctx.repo.list("teaching_materials", { eq: { assignment_id: id, visible_to_students: true } }),
    ctx.repo.list("submissions", { eq: { assignment_id: id, student_id: studentId } }),
  ]);
  const submission = subs[0] ?? null;
  const files = submission ? await ctx.repo.list("submission_files", { eq: { submission_id: submission.id }, order: { column: "version" } }) : [];
  let released: { version: number; final_score: number | null; student_feedback: string | null; strengths: string | null; improvements: string | null; revision_requested: boolean; revision_deadline: string | null }[] = [];
  if (submission) {
    const reviews = await ctx.repo.list("reviews", { eq: { submission_id: submission.id } });
    const feedback = await ctx.repo.list("feedback", { eq: { submission_id: submission.id, released: true } });
    released = feedback
      .map((f) => {
        const r = reviews.find((x) => x.id === f.review_id);
        if (!r) return null;
        return {
          version: r.version,
          // Only instructor-approved scores are ever shown to students; never provisional or AI scores.
          final_score: r.status === "approved" ? r.final_score : null,
          student_feedback: f.student_feedback,
          strengths: f.strengths,
          improvements: f.improvements,
          revision_requested: r.revision_requested,
          revision_deadline: r.revision_deadline,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.version - a.version);
  }
  return {
    assignment,
    subject,
    criteria: criteria as RubricCriterion[],
    materials,
    submission,
    files,
    released,
    status: deriveWorkStatus(assignment, true, submission),
  };
}
